import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDataVisual,
  libraryVisualIssue,
  isDataVisualReference,
} from "../dataVisuals.js";

const common = {
  title: "Survey responses",
  purpose: "Compare the responses in the supplied survey",
  source: { kind: "user-provided", label: "Customer survey, October 2026" },
};
const bars = {
  ...common,
  kind: "bar",
  unit: "%",
  data: [
    { label: "None", value: 0 },
    { label: "A", value: 25 },
    { label: "B", value: 25 },
    { label: "All", value: 100 },
  ],
};
const diagram = {
  ...common,
  kind: "diagram",
  nodes: [
    { id: "request", label: "Request" },
    { id: "validate", label: "Validate" },
    { id: "render", label: "Render" },
  ],
  edges: [
    { from: "request", to: "validate", label: "Submit" },
    { from: "validate", to: "render", label: "Valid input" },
  ],
};

function ready(input: unknown) {
  const result = buildDataVisual(input);
  assert.equal(result.status, "ready", JSON.stringify(result));
  if (result.status !== "ready") throw new Error("Expected visual");
  assert.equal(result.validation.valid, true);
  assert.deepEqual(result.validation.warnings, []);
  return result;
}

function omitted(input: unknown, message?: RegExp) {
  const result = buildDataVisual(input);
  assert.equal(result.status, "omitted");
  assert.equal("payload" in result, false);
  assert.equal("visual" in result, false);
  if (message) assert.match(JSON.stringify(result), message);
}

test("bar geometry preserves zero, equal values and proportions in the actual SVG", () => {
  const result = ready(bars);
  const geometry = result.geometry as any;
  const widths = [
    ...result.visual.svg.matchAll(
      /<rect x="[^"]+" y="[^"]+" width="([^"]+)" height="[^"]+" fill=/g,
    ),
  ].map((match) => Number(match[1]));
  assert.equal(widths.length, 4);
  assert.equal(widths[0], 0, "zero must not be given a cosmetic minimum bar");
  assert.equal(widths[1], widths[2]);
  assert.ok(Math.abs(widths[1] / widths[3] - 0.25) < 1e-7);
  assert.deepEqual(geometry.domain, [0, 100]);
  assert.match(
    result.visual.svg,
    new RegExp(`<text x="${geometry.zeroX}"[^>]*font-size="20"`),
    "zero tick must align with the actual baseline",
  );
  assert.match(result.visual.svg, /User-provided: Customer survey/);
  assert.match(result.sourceVerification, /not independently verified/);
});

test("negative bars extend from a shared zero and all-zero data remains zero", () => {
  const result = ready({
    ...bars,
    data: [
      { label: "Loss", value: -50 },
      { label: "Gain", value: 100 },
    ],
  });
  const geometry = result.geometry as any;
  assert.deepEqual(geometry.domain, [-50, 100]);
  assert.ok(geometry.bars[0].x < geometry.zeroX);
  assert.ok(
    Math.abs(geometry.bars[0].x + geometry.bars[0].width - geometry.zeroX) <
      1e-3,
  );
  assert.equal(geometry.bars[1].x, geometry.zeroX);
  const zero = ready({
    ...bars,
    data: [
      { label: "A", value: 0 },
      { label: "B", value: 0 },
    ],
  });
  assert.ok((zero.geometry as any).bars.every((bar: any) => bar.width === 0));
  assert.doesNotMatch(zero.visual.svg, /NaN|Infinity/);
});

test("progress percentages and actual SVG fills share a fixed 0–100 scale", () => {
  for (const width of [720, 1280, 1920]) {
    for (const value of [0, 0.75, 33.3, 60, 75, 100]) {
      const result = ready({ ...common, kind: "progress", unit: "%", width,
        data: [{ label: "Completion", value }] });
      const geometry = result.geometry as any;
      const rects = [...result.visual.svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="24" fill="([^"]+)"\/>/g)];
      assert.equal(rects.length, 2, "one track and one fill");
      assert.deepEqual(geometry.domain, [0, 100]);
      assert.equal(rects[0][1], rects[1][1]);
      assert.equal(rects[0][2], rects[1][2]);
      assert.ok(Math.abs(Number(rects[1][3]) / Number(rects[0][3]) - value / 100) < 1e-7);
      assert.match(result.visual.svg, new RegExp(`>${String(value).replace('.', '\\.')}%<`));
      assert.equal(geometry.bars[0].percentText, `${value}%`);
      if (value === 0) assert.equal(Number(rects[1][3]), 0);
      if (value === 100) assert.equal(rects[1][3], rects[0][3]);
      if (value === 75) assert.equal(Number(rects[1][3]), Number(rects[0][3]) * 0.75);
    }
  }
});

test("rebuilding progress from 60 to 75 updates both text and fill", () => {
  const input = { ...common, kind: "progress", unit: "%", data: [{ label: "Completion", value: 60 }] };
  const before = ready(input);
  const after = ready({ ...input, data: [{ label: "Completion", value: 75 }] });
  assert.equal((after.geometry as any).bars[0].width / (before.geometry as any).bars[0].width, 75 / 60);
  assert.match(before.visual.svg, />60%</);
  assert.match(after.visual.svg, />75%</);
  assert.doesNotMatch(after.visual.svg, />60%</);
  assert.equal(input.data[0].value, 60);
});

test("progress refuses invalid percentages, ambiguous units and missing provenance", () => {
  const input = { ...common, kind: "progress", unit: "%", data: [{ label: "Completion", value: 75 }] };
  for (const value of [-1, 100.01, NaN, Infinity]) omitted({ ...input, data: [{ label: "Completion", value }] });
  for (const unit of [undefined, "items", "fraction"]) omitted({ ...input, unit }, /unit|percent/);
  omitted({ ...input, source: undefined }, /source/);
  omitted({ ...input, data: [] }, /at least one/);
  omitted({ ...input, data: [{ label: "Completion", value: 75, x: 1 }] }, /numeric x/);
});

test("progress bars, rings and gauges require binding before library reuse", () => {
  for (const slug of ["progress-bar", "progress-bars", "progress_ring", "progress-card", "percent-ring", "completion-gauge", "donut-progress", "apppersonal-trial-progress"]) {
    assert.ok(isDataVisualReference({ slug }));
    assert.match(libraryVisualIssue({ slug })!, /no declared/);
    assert.equal(libraryVisualIssue({ slug, meta: { chartMode: "data-bound" } }), undefined);
  }
  assert.ok(isDataVisualReference(null, "Show a progress bar at 75%"));
  assert.equal(isDataVisualReference({ slug: "plain-title" }), false);
});

test("line charts space observations by numeric x and retain actual values", () => {
  const result = ready({
    ...common,
    kind: "line",
    unit: "orders",
    xUnit: "days",
    data: [
      { label: "Start", x: 0, value: 0 },
      { label: "Day 2", x: 2, value: 50 },
      { label: "Day 8", x: 8, value: 100 },
    ],
  });
  const points = (result.geometry as any).points;
  assert.equal(
    (points[1].px - points[0].px) / (points[2].px - points[0].px),
    0.25,
  );
  assert.ok(points[1].py < points[0].py);
  assert.ok(points[2].py < points[1].py);
  assert.match(result.visual.svg, /polyline/);
});

test("missing meaning or provenance omits the visual without rendering a scaffold", () => {
  for (const field of ["title", "purpose", "source", "unit", "data"])
    omitted({ ...bars, [field]: undefined });
  omitted({ kind: "bar" });
  omitted({ ...bars, data: [] });
  omitted({ ...bars, data: [{ label: "One", value: 3 }] }, /at least two/);
});

test("the captured flat-temperature brief stays flat without a y-axis label collision", () => {
  for (const [width, height] of [[1280, 720], [1920, 1080]]) {
    const result = ready({
      kind: "line",
      title: "Room temperature log",
      purpose: "How do the four supplied room temperature readings compare?",
      source: { kind: "illustrative", label: "Supplied readings" },
      allowIllustrative: true,
      unit: "°C",
      xUnit: "Hours",
      width,
      height,
      data: [0, 4, 8, 12].map(x => ({ x, label: String(x), value: 21.5 })),
    });
    const points = (result.geometry as any).points;
    assert.equal(points.length, 4);
    assert.ok(points.every((point: any) => point.value === 21.5 && point.py === points[0].py));
    const gaps = points.slice(1).map((point: any, index: number) => point.px - points[index].px);
    assert.ok(gaps.every((gap: number) => Math.abs(gap - gaps[0]) < 0.001));
    assert.match(result.visual.svg, /21\.5/);
  }
});

test("missing data and nodes do not falsely report duplicate labels or identifiers", () => {
  for (const kind of ["bar", "line", "diagram"]) {
    const result = buildDataVisual({ kind });
    assert.equal(result.status, "omitted");
    assert.doesNotMatch(JSON.stringify(result), /must be unique|distinct entities/);
  }
});

test("bad numeric inputs are not coerced, normalized, clamped or discarded", () => {
  for (const value of ["25", null, NaN, Infinity, -Infinity, 1e13]) {
    omitted({
      ...bars,
      data: [
        { label: "A", value },
        { label: "B", value: 100 },
      ],
    });
  }
  omitted(
    {
      ...bars,
      data: [
        { label: "A", value: 25 },
        { label: "A", value: 100 },
      ],
    },
    /unique/,
  );
  omitted(
    {
      ...bars,
      data: [
        { label: "A", value: 25, x: 1 },
        { label: "B", value: 100, x: 2 },
      ],
    },
    /categorical/,
  );
});

test("line charts reject missing, duplicate, unordered and unreadably close x coordinates", () => {
  const input = { ...common, kind: "line", unit: "orders", xUnit: "days" };
  for (const xs of [
    [undefined, 2],
    [2, 2],
    [5, 2],
  ])
    omitted({
      ...input,
      data: xs.map((x, i) => ({ label: `Day ${i}`, x, value: 5 })),
    });
  omitted(
    {
      ...input,
      data: [
        { label: "A", x: 0, value: 2 },
        { label: "B", x: 0.001, value: 2 },
        { label: "C", x: 20, value: 5 },
      ],
    },
    /overlap/,
  );
});

test("illustrative data is opt-in and visibly labeled", () => {
  const input = {
    ...bars,
    source: { kind: "illustrative", label: "Example survey" },
  };
  omitted(input, /explicit user request/);
  const result = ready({ ...input, allowIllustrative: true });
  assert.match(result.visual.svg, /Illustrative data: Example survey/);
});

test("the diagram paints only the supplied directed relationships and labels", () => {
  const result = ready(diagram);
  const geometry = result.geometry as any;
  assert.deepEqual(
    geometry.edges.map(({ from, to, label }: any) => ({ from, to, label })),
    diagram.edges,
  );
  assert.equal((result.visual.svg.match(/marker-end=/g) ?? []).length, 2);
  for (const edge of geometry.edges) assert.ok(edge.y1 < edge.y2);
  assert.match(result.summary, /Request -> Validate: Submit/);
});

test("a branching diagram supports explicit outcomes without inventing edges", () => {
  ready({
    ...diagram,
    edges: [
      { from: "request", to: "validate", label: "Check" },
      { from: "request", to: "render", label: "Preview" },
    ],
  });
});

test("ambiguous, unsupported and fabricated diagram structure is omitted", () => {
  omitted({ ...diagram, edges: [] }, /explicit labeled/);
  omitted(
    {
      ...diagram,
      edges: [{ from: "request", to: "missing", label: "Submit" }],
    },
    /declared node/,
  );
  omitted(
    {
      ...diagram,
      edges: [
        ...diagram.edges,
        { from: "render", to: "request", label: "Repeat" },
      ],
    },
    /Cycles/,
  );
  omitted(
    {
      ...diagram,
      nodes: [...diagram.nodes, { id: "orphan", label: "Unrelated" }],
    },
    /no stated relationship/,
  );
  omitted(
    { ...diagram, edges: [...diagram.edges, diagram.edges[0]] },
    /Duplicate/,
  );
  omitted(
    {
      ...diagram,
      edges: [
        ...diagram.edges,
        { from: "request", to: "render", label: "Skip" },
      ],
    },
    /skips a level/,
  );
});

test("dense layouts fail closed instead of shrinking text, truncating data or clipping", () => {
  omitted(
    {
      ...bars,
      width: 720,
      height: 540,
      data: Array.from({ length: 8 }, (_, i) => ({
        label: `Category ${i}`,
        value: i,
      })),
    },
    /Too many bars/,
  );
  omitted({ ...diagram, height: 540 }, /Too many diagram levels/);
  omitted(
    {
      ...bars,
      width: 720,
      data: [
        { label: "A very long category label to wrap", value: 10 },
        { label: "Another category label to wrap", value: 20 },
      ],
    },
    /needs more room|too wide/,
  );
});

test("markup is escaped and caller objects are neither mutated nor embedded as executable code", () => {
  const input = { ...bars, title: "<script>alert(1)</script> & results" };
  const before = JSON.stringify(input);
  const result = ready(input);
  assert.equal(JSON.stringify(input), before);
  assert.doesNotMatch(result.visual.svg, /<script>/);
  assert.match(result.visual.svg, /&lt;script&gt;/);
  omitted({
    ...bars,
    source: {
      kind: "reference",
      label: "Unsafe URL",
      url: "javascript:alert(1)",
    },
  });
});

test("generation is reproducible and changing numbers changes geometry, not merely labels", () => {
  assert.deepEqual(buildDataVisual(bars), buildDataVisual(bars));
  const before = ready(bars);
  const after = ready({
    ...bars,
    data: bars.data.map((point, i) =>
      i === 1 ? { ...point, value: 50 } : point,
    ),
  });
  assert.equal(
    (after.geometry as any).bars[1].width,
    (before.geometry as any).bars[1].width * 2,
  );
});

test("unsafe library references are blocked, while declared data binding can supersede legacy classification", () => {
  assert.match(
    libraryVisualIssue({ slug: "dataviz-monthly-report" })!,
    /decorative/,
  );
  assert.match(
    libraryVisualIssue({ slug: "new-flowchart", title: "Payment flowchart" })!,
    /no declared/,
  );
  assert.equal(
    libraryVisualIssue({
      slug: "dataviz-monthly-report",
      meta: { chartMode: "data-bound" },
    }),
    undefined,
  );
  assert.equal(libraryVisualIssue({ slug: "product-promo" }), undefined);
  assert.equal(
    isDataVisualReference({
      slug: "survey",
      meta: { chartMode: "data-bound" },
    }),
    true,
    "Even a bound chart's sample data cannot be copied as the user's facts by an automatic fallback",
  );
});
