import { z } from "zod";
import { validateProject } from "./zvidSchema.js";

/** MCP authoring policy, not a new renderer element or project-schema field. */
export const DATA_VISUAL_GUIDELINES = [
  "MEANING BEFORE DECORATION: a chart must answer a stated question using supplied numeric data; a diagram must explain supplied entities and relationships. If that information is absent, omit the visual or ask for it. Never invent values, trends, percentages, causal arrows or connections to fill space.",
  "Use build_data_visual for bar charts, numeric-x line charts, percentage progress bars and small directed acyclic diagrams. It calculates geometry from structured inputs and returns status omitted with no payload when data, provenance or readable layout is insufficient. Do not replace an omitted result with an improvised chart.",
  "Progress bars are quantitative visuals: use kind progress with unit % and data values from 0 to 100. The builder uses one value for both the printed percentage and fill width on a fixed 0–100% track (75 means 75%, never 0.75). Do not copy a template's fill while changing its label. Rebuild both whenever values change; omit unsupported gauges/rings unless independently checked. Keep the percentage and fill synchronized throughout any animation, or use the static builder visual.",
  "Start with the builder's default full canvas size (1280 by 720); its dimensions include the title, axes and source. Insert the returned visual.svg unchanged into a same-size scene. Design the surrounding scenes using the library; do not redraw the checked geometry or substitute HTML bars/arrows. If omitted, correct the stated input/layout issue and call the builder again, or omit the visual and report why.",
  "Source descriptions are caller-supplied provenance, not fact verification. Preserve units, period and scope in labels/source. Illustrative data requires the user's explicit request and a visible Illustrative data label; never present example defaults as facts about the user.",
  "Charts need labeled categories/axes, units, exact values and an honest shared scale. Zero values stay zero. Line spacing must follow numeric x values. Diagrams need named nodes and labeled, directionally correct edges; proximity alone is not a relationship.",
  "This policy overrides example-first and preserve-layout rules: remove or rebuild decorative/unverified charts and diagrams, even from a matching template. Copy changes alone do not update chart geometry or diagram meaning.",
  "build_data_visual output is static SVG in ordinary Zvid project JSON. When template data changes, rebuild the entire visual from the new structured data; changing just its text or adding {{value}} placeholders does not bind its geometry. Retain the input specification outside the render payload. Validate the composed project and inspect its actual preview before publishing.",
  "Arbitrary SVG, HTML, images and existing templates cannot be semantically verified by schema validation. Do not claim a passing validation proves their data or relationships are correct. Unsupported visual types must be omitted or implemented with an independently checked data-driven renderer.",
];

const shortText = (max: number) => z.string().trim().min(1).max(max);
const number = z.number().finite().min(-1e12).max(1e12);
const sourceSchema = z
  .object({
    kind: z.enum(["user-provided", "reference", "illustrative"]),
    label: shortText(120).describe(
      "Dataset or relationship source, including relevant period/scope. Do not invent provenance.",
    ),
    url: z
      .string()
      .url()
      .regex(/^https?:\/\//)
      .max(2048)
      .optional(),
  })
  .strict();

export const dataVisualInputShape = {
  kind: z.enum(["bar", "line", "progress", "diagram"]),
  title: shortText(90)
    .optional()
    .describe("Required for a ready visual. A concise descriptive chart or diagram title."),
  purpose: shortText(300)
    .optional()
    .describe(
      "The question the visual answers. Must be supported by the supplied data/relationships.",
    ),
  source: sourceSchema.optional(),
  allowIllustrative: z
    .boolean()
    .default(false)
    .describe(
      "Only true when the user explicitly requests illustrative/example data.",
    ),
  width: z.number().int().min(720).max(1920).default(1280)
    .describe("Full visual canvas width, including labels and source. Default 1280. Preserve the returned SVG when placing it in a video."),
  height: z.number().int().min(540).max(1920).default(720)
    .describe("Full visual canvas height, including title, axes and source, not a small scene panel. Default 720; minimum 540. Omit to use the readable default."),
  unit: shortText(24)
    .optional()
    .describe(
      "Chart value unit, e.g. USD, orders, or %. No implicit percent conversion.",
    ),
  xUnit: shortText(24)
    .optional()
    .describe("Line chart numeric x-axis unit, e.g. days since launch."),
  data: z
    .array(
      z
        .object({
          label: shortText(36),
          value: number,
          x: number.optional(),
        })
        .strict(),
    )
    .max(8)
    .optional(),
  nodes: z
    .array(z.object({ id: shortText(40), label: shortText(48) }).strict())
    .max(6)
    .optional(),
  edges: z
    .array(
      z
        .object({
          from: shortText(40),
          to: shortText(40),
          label: shortText(28),
        })
        .strict(),
    )
    .max(8)
    .optional(),
};

const inputSchema = z.object(dataVisualInputShape).strict();
type Input = z.infer<typeof inputSchema>;
type Box = { x: number; y: number; width: number; height: number };
type Label = Box & {
  text: string;
  fontSize: number;
  align: "start" | "middle" | "end";
  color: string;
  lines: string[];
};

const xml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const coord = (value: number) => Number(value.toFixed(4));
// Preserve numeric precision in labels, while grouping long integers so they
// also satisfy the renderer's SVG numeric-token limits.
const valueText = (value: number) => {
  const [integer, fraction] = String(value).split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction === undefined ? "" : `.${fraction}`)
  );
};
const textWidth = (text: string, size: number) =>
  Array.from(text).reduce(
    (sum, char) => sum + size * (/[^\u0000-\u024f]/.test(char) ? 1 : 0.68),
    0,
  );
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

class LayoutError extends Error {}

function omitted(issues: { field: string; message: string }[]) {
  return {
    status: "omitted" as const,
    issues,
    nextStep:
      "Omit this chart/diagram. Supply the missing or corrected information, simplify it, or use a plain factual text summary. Do not fabricate a replacement.",
  };
}

/** No network, randomness, credit spending, persistence, or model sampling. */
export function buildDataVisual(raw: unknown) {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success)
    return omitted(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  const input = parsed.data;
  const issues: { field: string; message: string }[] = [];
  const problem = (field: string, message: string) =>
    issues.push({ field, message });
  if (!input.title) problem("title", "Provide a descriptive title.");
  if (!input.purpose)
    problem(
      "purpose",
      "State the question or relationship this visual explains.",
    );
  if (!input.source)
    problem(
      "source",
      "Provide the source of the numbers or relationships; do not invent one.",
    );
  if (input.source?.kind === "illustrative" && !input.allowIllustrative)
    problem(
      "allowIllustrative",
      "Illustrative data requires an explicit user request.",
    );
  if (input.kind !== "diagram") {
    if (!input.unit) problem("unit", "Provide the measured unit.");
    const minimumValues = input.kind === "progress" ? 1 : 2;
    if (!input.data || input.data.length < minimumValues)
      problem(
        "data",
        input.kind === "progress"
          ? "Supply at least one labeled percentage value."
          : "Supply at least two labeled numeric values; use a metric/text card for a single value.",
      );
    if (input.kind === "progress") {
      if (input.unit !== "%")
        problem("unit", "Progress values must be percentages with unit %. Convert counts using their supplied total before building; do not guess the total.");
      if (input.data?.some((point) => point.value < 0 || point.value > 100))
        problem("data.value", "Progress percentages must be between 0 and 100; do not clamp or invent an over-target scale.");
    }
    if (input.nodes || input.edges)
      problem(
        "nodes",
        "Chart inputs cannot also contain diagram nodes or edges.",
      );
    if (
      input.data &&
      new Set(input.data.map((point) => point.label.toLowerCase())).size !==
        input.data.length
    )
      problem("data", "Category labels must be unique.");
    if (input.kind === "line") {
      if (!input.xUnit)
        problem(
          "xUnit",
          "Provide the numeric x-axis unit. Use a bar chart for unordered categories.",
        );
      if (input.data?.some((point) => point.x === undefined))
        problem(
          "data.x",
          "Every line point requires an explicit numeric x coordinate.",
        );
      if (
        input.data?.some(
          (point, index, all) => index > 0 && point.x! <= all[index - 1].x!,
        )
      )
        problem(
          "data.x",
          "Line x coordinates must be unique and strictly increasing; do not silently reorder the data.",
        );
    } else if (
      input.xUnit ||
      input.data?.some((point) => point.x !== undefined)
    ) {
      problem(
        "data.x",
        "Bars are categorical; remove numeric x coordinates or choose line.",
      );
    }
  } else {
    if (input.data || input.unit || input.xUnit)
      problem(
        "data",
        "Diagram inputs cannot also contain chart data or units.",
      );
    if (!input.nodes || input.nodes.length < 2)
      problem("nodes", "Supply at least two named entities.");
    if (!input.edges?.length)
      problem(
        "edges",
        "Supply explicit labeled relationships; do not invent arrows.",
      );
    const ids = new Set(input.nodes?.map((node) => node.id));
    if (input.nodes && ids.size !== input.nodes.length)
      problem("nodes", "Node IDs must be unique.");
    if (
      input.nodes &&
      new Set(input.nodes.map((node) => node.label.toLowerCase())).size !==
        input.nodes.length
    )
      problem("nodes", "Node labels must identify distinct entities.");
    const pairs = new Set<string>();
    for (const edge of input.edges ?? []) {
      if (!ids.has(edge.from) || !ids.has(edge.to))
        problem("edges", "Every endpoint must refer to a declared node ID.");
      if (edge.from === edge.to)
        problem("edges", "Self loops are not supported by this layout.");
      const pair = JSON.stringify([edge.from, edge.to]);
      if (pairs.has(pair))
        problem(
          "edges",
          "Duplicate connections are ambiguous; combine their labels.",
        );
      pairs.add(pair);
    }
    for (const id of ids)
      if (!input.edges?.some((edge) => edge.from === id || edge.to === id))
        problem("edges", `Node ${id} has no stated relationship.`);
  }
  if (issues.length) return omitted(issues);
  try {
    return compose(input);
  } catch (error) {
    if (error instanceof LayoutError)
      return omitted([{ field: "layout", message: error.message }]);
    throw error;
  }
}

function compose(input: Input) {
  const { width, height } = input;
  const labels: Label[] = [];
  const shapes: string[] = [];
  const margin = 40;
  const label = (
    text: string,
    box: Box,
    size = 26,
    align: Label["align"] = "start",
    color = "#0f172a",
    maxLines = 2,
  ) => {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (textWidth(word, size) > box.width)
        throw new LayoutError(
          `Label "${text}" is too wide. Shorten it or increase the canvas width.`,
        );
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size) > box.width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const actualHeight = lines.length * size * 1.25;
    if (lines.length > maxLines || actualHeight > box.height)
      throw new LayoutError(
        `Label "${text}" needs more room. Simplify the visual or shorten its labels.`,
      );
    const actualWidth = Math.max(...lines.map((text) => textWidth(text, size)));
    const bounds = {
      x:
        box.x +
        (align === "middle"
          ? (box.width - actualWidth) / 2
          : align === "end"
            ? box.width - actualWidth
            : 0),
      y: box.y,
      width: actualWidth,
      height: actualHeight,
    };
    if (
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.x + bounds.width > width ||
      bounds.y + bounds.height > height ||
      labels.some((other) => overlap(bounds, other))
    )
      throw new LayoutError(
        "Labels would overlap or leave the canvas. Simplify the visual or increase its dimensions.",
      );
    labels.push({ ...bounds, text, fontSize: size, align, color, lines });
  };
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = "#cbd5e1",
    extra = "",
  ) =>
    shapes.push(
      `<line x1="${coord(x1)}" y1="${coord(y1)}" x2="${coord(x2)}" y2="${coord(y2)}" stroke="${color}" stroke-width="2" ${extra}/>`,
    );
  label(
    input.title!,
    { x: margin, y: 24, width: width - 2 * margin, height: 90 },
    34,
  );
  const provenance = input.source!;
  const prefix =
    provenance.kind === "illustrative"
      ? "Illustrative data"
      : provenance.kind === "user-provided"
        ? "User-provided"
        : "Source";
  label(
    `${prefix}: ${provenance.label}`,
    { x: margin, y: height - 74, width: width - 2 * margin, height: 65 },
    22,
  );
  let geometry: Record<string, unknown>;

  if (input.kind === "progress") {
    const data = input.data!;
    const top = 150;
    const bottom = height - 128;
    const rowHeight = Math.min(108, (bottom - top) / data.length);
    if (rowHeight < 86)
      throw new LayoutError("Too many progress bars for readable labels. Increase height or split the visual.");
    const trackWidth = width - 2 * margin;
    const bars = data.map((point, index) => {
      const y = top + index * rowHeight;
      label(point.label, { x: margin, y, width: trackWidth - 270, height: 36 }, 26, "start", "#0f172a", 1);
      const percentText = `${valueText(point.value)}%`;
      label(percentText, { x: width - margin - 250, y, width: 250, height: 36 }, 26, "end", "#0f172a", 1);
      const fillWidth = coord(trackWidth * point.value / 100);
      const barY = coord(y + 46);
      shapes.push(`<rect x="${margin}" y="${barY}" width="${trackWidth}" height="24" fill="#e2e8f0"/>`);
      // Square ends and zero width preserve the measured filled fraction;
      // cosmetic minimum widths or separate rounded end caps distort it.
      shapes.push(`<rect x="${margin}" y="${barY}" width="${fillWidth}" height="24" fill="#1d4ed8"/>`);
      return { label: point.label, value: point.value, percentText, x: margin, y: barY, width: fillWidth, trackWidth };
    });
    geometry = { kind: "progress", domain: [0, 100], bars };
  } else if (input.kind === "bar") {
    const data = input.data!;
    const values = data.map((point) => point.value);
    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values) || (minimum === 0 ? 1 : 0);
    const domain = maximum - minimum;
    const left = Math.max(190, width * 0.24);
    const right = width - margin;
    const top = 166;
    const bottom = height - 138;
    const rowHeight = (bottom - top) / data.length;
    if (rowHeight < 58)
      throw new LayoutError(
        "Too many bars for readable labels at this height. Increase height or split the chart.",
      );
    const x = (value: number) =>
      left + ((value - minimum) / domain) * (right - left);
    label(
      input.unit!,
      { x: left, y: 112, width: right - left, height: 40 },
      24,
    );
    const ticks = [minimum, (minimum + maximum) / 2, maximum];
    if (minimum < 0 && maximum > 0 && !ticks.includes(0)) ticks.push(0);
    for (const value of ticks) {
      const px = x(value);
      line(px, top, px, bottom, value === 0 ? "#475569" : "#e2e8f0");
      label(
        valueText(value),
        { x: px - 60, y: bottom + 8, width: 120, height: 34 },
        20,
        "middle",
        "#475569",
        1,
      );
    }
    const bars = data.map((point, index) => {
      const y = top + index * rowHeight;
      const start = x(Math.min(0, point.value));
      const barWidth = Math.abs(x(point.value) - x(0));
      label(
        point.label,
        {
          x: margin,
          y: y + 12,
          width: left - margin - 22,
          height: rowHeight - 12,
        },
        24,
        "end",
      );
      label(
        valueText(point.value),
        { x: left + 4, y: y + 2, width: right - left - 8, height: 31 },
        22,
      );
      shapes.push(
        `<rect x="${coord(start)}" y="${coord(y + 34)}" width="${coord(barWidth)}" height="${coord(Math.min(22, rowHeight - 40))}" fill="${point.value < 0 ? "#9f1239" : "#1d4ed8"}"/>`,
      );
      return {
        label: point.label,
        value: point.value,
        x: coord(start),
        y: coord(y + 34),
        width: coord(barWidth),
      };
    });
    geometry = {
      kind: "bar",
      domain: [minimum, maximum],
      zeroX: coord(x(0)),
      bars,
    };
  } else if (input.kind === "line") {
    const data = input.data!;
    const minimum = Math.min(0, ...data.map((point) => point.value));
    const maximum =
      Math.max(0, ...data.map((point) => point.value)) ||
      (minimum === 0 ? 1 : 0);
    const xMin = data[0].x!;
    const xMax = data[data.length - 1].x!;
    const left = 140,
      right = width - 100,
      top = 200,
      bottom = height - 210;
    if (bottom - top < 100)
      throw new LayoutError("Increase the height for a readable line chart.");
    const points = data.map((point) => ({
      ...point,
      px: coord(left + ((point.x! - xMin) / (xMax - xMin)) * (right - left)),
      py: coord(
        bottom -
          ((point.value - minimum) / (maximum - minimum)) * (bottom - top),
      ),
    }));
    label(
      input.unit!,
      { x: margin, y: 116, width: width - margin * 2, height: 40 },
      24,
    );
    for (const value of [minimum, (minimum + maximum) / 2, maximum]) {
      const py =
        bottom - ((value - minimum) / (maximum - minimum)) * (bottom - top);
      line(left, py, right, py, "#cbd5e1");
      label(
        valueText(value),
        { x: 0, y: py - 12, width: left - 16, height: 30 },
        20,
        "end",
        "#475569",
        1,
      );
    }
    label(
      input.xUnit!,
      { x: left, y: height - 120, width: right - left, height: 36 },
      24,
      "middle",
    );
    shapes.push(
      `<polyline points="${points.map((point) => `${point.px},${point.py}`).join(" ")}" fill="none" stroke="#1d4ed8" stroke-width="3"/>`,
    );
    for (const [index, point] of points.entries()) {
      label(
        valueText(point.value),
        // The first point sits on the y-axis. Put its value inside the plot
        // so long decimal values cannot collide with the neighboring y tick.
        { x: index === 0 ? point.px + 8 : point.px - 65, y: point.py - 36, width: 130, height: 30 },
        22,
        index === 0 ? "start" : "middle",
        "#0f172a",
        1,
      );
      label(
        `${point.label} (${valueText(point.x!)})`,
        { x: point.px - 75, y: bottom + 20, width: 150, height: 70 },
        22,
        "middle",
      );
      shapes.push(
        `<circle cx="${point.px}" cy="${point.py}" r="5" fill="#1d4ed8"/>`,
      );
    }
    geometry = {
      kind: "line",
      xDomain: [xMin, xMax],
      yDomain: [minimum, maximum],
      points,
    };
  } else {
    const nodes = input.nodes!,
      edges = input.edges!;
    const ranks = new Map<string, number>();
    for (let pass = 0; pass < nodes.length; pass++) {
      for (const node of nodes) {
        if (ranks.has(node.id)) continue;
        const parents = edges
          .filter((edge) => edge.to === node.id)
          .map((edge) => edge.from);
        if (parents.every((id) => ranks.has(id)))
          ranks.set(
            node.id,
            parents.length
              ? Math.max(...parents.map((id) => ranks.get(id)!)) + 1
              : 0,
          );
      }
    }
    if (ranks.size !== nodes.length)
      throw new LayoutError(
        "Cycles are not supported by this diagram layout. Use a separately checked cyclic layout or omit the diagram.",
      );
    const levels = Math.max(...ranks.values()) + 1;
    const nodeHeight = 84;
    const top = 132,
      bottom = height - 110;
    const step = (bottom - top - nodeHeight) / (levels - 1);
    if (step < 175)
      throw new LayoutError(
        "Too many diagram levels for this height. Increase height or simplify the relationships.",
      );
    const boxes = new Map<string, Box>();
    for (let rank = 0; rank < levels; rank++) {
      const row = nodes.filter((node) => ranks.get(node.id) === rank);
      const slot = (width - 2 * margin) / row.length;
      const nodeWidth = Math.min(340, slot - 24);
      for (const [index, node] of row.entries())
        boxes.set(node.id, {
          x: margin + slot * index + (slot - nodeWidth) / 2,
          y: top + rank * step,
          width: nodeWidth,
          height: nodeHeight,
        });
    }
    const connections = edges.map((edge) => {
      if (ranks.get(edge.to)! - ranks.get(edge.from)! !== 1)
        throw new LayoutError(
          "A connection skips a level and could cross unrelated nodes. Simplify the diagram or use a separately checked layout.",
        );
      const from = boxes.get(edge.from)!,
        to = boxes.get(edge.to)!;
      return {
        ...edge,
        x1: from.x + from.width / 2,
        y1: from.y + from.height,
        x2: to.x + to.width / 2,
        y2: to.y,
      };
    });
    for (const [index, edge] of connections.entries()) {
      if (
        connections
          .slice(0, index)
          .some(
            (other) =>
              other.y1 === edge.y1 &&
              (other.x1 - edge.x1) * (other.x2 - edge.x2) < 0,
          )
      )
        throw new LayoutError(
          "Connections would cross and obscure their meaning. Reorder the supplied nodes or simplify the diagram.",
        );
      line(
        edge.x1,
        edge.y1,
        edge.x2,
        edge.y2 - 5,
        "#475569",
        'marker-end="url(#arrow)"',
      );
      const x = edge.x1 + (edge.x2 - edge.x1) * 0.65;
      label(
        edge.label,
        {
          x: x - 130,
          y: edge.y1 + (edge.y2 - edge.y1) * 0.5 - 8,
          width: 260,
          height: 65,
        },
        22,
        "middle",
      );
    }
    for (const node of nodes) {
      const box = boxes.get(node.id)!;
      shapes.push(
        `<rect x="${coord(box.x)}" y="${coord(box.y)}" width="${coord(box.width)}" height="${nodeHeight}" rx="12" fill="#eff6ff" stroke="#93c5fd"/>`,
      );
      label(
        node.label,
        {
          x: box.x + 14,
          y: box.y + 12,
          width: box.width - 28,
          height: nodeHeight - 20,
        },
        24,
        "middle",
      );
    }
    geometry = {
      kind: "diagram",
      nodes: nodes.map((node) => ({ ...node, ...boxes.get(node.id) })),
      edges: connections,
    };
  }

  // Text is painted last, with a white halo so arrows cannot obscure labels.
  const textSvg = labels
    .map((item) => {
      const x =
        item.x +
        (item.align === "middle"
          ? item.width / 2
          : item.align === "end"
            ? item.width
            : 0);
      return `<text x="${coord(x)}" y="${coord(item.y + item.fontSize)}" font-size="${item.fontSize}" text-anchor="${item.align}" fill="${item.color}" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${item.lines.map((line, index) => `<tspan x="${coord(x)}" dy="${index ? coord(item.fontSize * 1.25) : 0}">${xml(line)}</tspan>`).join("")}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs><rect width="${width}" height="${height}" fill="#ffffff"/>${shapes.join("")}${textSvg}</svg>`;
  const visual = {
    type: "SVG",
    svg,
    position: "custom",
    x: 0,
    y: 0,
    width,
    height,
  };
  const payload = {
    type: "image",
    name: "Data visual",
    width,
    height,
    outputFormat: "png",
    backgroundColor: "#ffffff",
    visuals: [visual],
  };
  const validation = validateProject(payload);
  if (!validation.valid) return omitted(validation.errors);
  return {
    status: "ready" as const,
    payload,
    visual,
    specification: input,
    geometry,
    sourceVerification:
      "Caller-supplied provenance only; the MCP has not independently verified the source or the factual claims.",
    summary:
      input.kind === "diagram"
        ? input
            .edges!.map(
              (edge) =>
                `${input.nodes!.find((node) => node.id === edge.from)!.label} -> ${input.nodes!.find((node) => node.id === edge.to)!.label}: ${edge.label}`,
            )
            .join("; ")
        : input
            .data!.map(
              (point) => `${point.label}: ${point.value} ${input.unit}`,
            )
            .join("; "),
    validation,
    nextStep:
      "Use the complete payload for an image or insert visual into a same-size video scene with enough reading time. Keep visual.svg unchanged; adapt the surrounding library design rather than redrawing the chart or diagram. Validate the composed project remotely and inspect the preview. Regenerate from specification whenever data changes; geometry is not template-bound.",
  };
}

/** Known decorative charts must never be quietly adopted as factual visuals. */
export function decorativeChart(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  const mode = meta?.chartMode ?? record.chartMode;
  if (mode === "data-bound" || mode === "none") return false;
  return (
    mode === "decorative" ||
    ["dataviz-monthly-report", "dataviz-survey-results"].includes(
      String(record.slug),
    )
  );
}

export function libraryVisualIssue(item: unknown): string | undefined {
  if (decorativeChart(item))
    return "This example uses decorative chart geometry that does not represent its numeric values.";
  if (!isDataVisualReference(item)) return undefined;
  const record = item as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  if (
    ["data-bound", "none"].includes(
      String(meta?.chartMode ?? record.chartMode),
    ) ||
    meta?.diagramMode === "relationship-bound"
  )
    return undefined;
  return "This chart/diagram example has no declared data or relationship binding; its visual meaning has not been established.";
}

/** Automatic fallback cannot ground facts by copying a library's sample data. */
export function isDataVisualReference(item: unknown, brief = ""): boolean {
  if (!item || typeof item !== "object")
    return /\b(chart|diagram|graph|infographic|dataviz|progress[-\s]+(?:bar|ring|meter)s?|gauges?|donuts?)\b/i.test(brief);
  const record = item as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  return (
    // This count-based example keeps a literal 516/860 fill even when its
    // usedCount/totalCount or headline variables change.
    record.slug === "apppersonal-trial-progress" ||
    Boolean(meta?.chartMode || meta?.diagramMode) ||
    /\b(chart|diagram|graph|infographic|dataviz|flowchart|progress[-\s]+(?:bar|ring|meter|card)s?|percent(?:age)?[-\s]+(?:bar|ring)s?|gauges?|donuts?)\b/i.test(
      [
        brief,
        record.slug,
        record.title,
        record.description,
        meta?.pack,
        meta?.category,
      ]
        .join(" ")
        .replace(/[-_]/g, " "),
    )
  );
}
