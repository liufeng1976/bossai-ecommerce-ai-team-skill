import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readInputFile(filePath) {
  const absolute = path.resolve(filePath);
  const content = await readFile(absolute, "utf8");
  if (path.extname(absolute).toLowerCase() === ".json") {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`无法解析 JSON：${absolute}。${error.message}`);
    }
  }
  return parseMarkdownInput(content, absolute);
}

export async function writeText(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

export async function writeJson(filePath, value) {
  await writeText(filePath, JSON.stringify(value, null, 2));
}

export function parseMarkdownInput(content, sourceName = "markdown") {
  const sections = splitSections(content);
  const businessSection = sections.find((section) => /业务|项目|business|context/i.test(section.heading));
  const signalSections = sections.filter((section) => /机会|信号|痛点|需求|signal|opportunit/i.test(section.heading));

  const business = {
    name: extractField(businessSection?.body, ["项目", "名称", "name"]) || "Markdown 导入项目",
    platforms: splitList(extractField(businessSection?.body, ["平台", "platform"])),
    customer: extractField(businessSection?.body, ["客户", "用户", "customer"]) || "待明确",
    goal: extractField(businessSection?.body, ["目标", "goal"]) || "验证一项可成交的电商机会",
    offer: extractField(businessSection?.body, ["产品", "服务", "offer"]) || "待明确",
    constraints: splitList(extractField(businessSection?.body, ["约束", "限制", "constraint"])),
    notes: businessSection?.body || ""
  };

  const signals = signalSections.length
    ? signalSections.map((section, index) => sectionToSignal(section, index, sourceName))
    : bulletSignals(content, sourceName);

  return { business, signals };
}

function sectionToSignal(section, index, sourceName) {
  const title = section.heading.replace(/^#+\s*/, "").replace(/^(机会|信号|痛点|需求|signal|opportunity)\s*[:：-]?\s*/i, "").trim();
  return {
    id: `MD-${String(index + 1).padStart(3, "0")}`,
    title: title || `Markdown 信号 ${index + 1}`,
    summary: extractField(section.body, ["摘要", "描述", "问题", "summary", "description"]) || firstParagraph(section.body),
    source: extractField(section.body, ["来源", "source"]) || sourceName,
    url: extractUrl(section.body),
    evidence: extractField(section.body, ["证据", "原话", "evidence", "quote"]) || "",
    tags: splitList(extractField(section.body, ["标签", "关键词", "tags"]))
  };
}

function bulletSignals(content, sourceName) {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*+]\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean)
    .map((title, index) => ({
      id: `MD-${String(index + 1).padStart(3, "0")}`,
      title,
      summary: "",
      source: sourceName,
      evidence: ""
    }));
}

function splitSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let current = { heading: "正文", body: [] };
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
      current = { heading: line.replace(/^#{1,6}\s+/, "").trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
  return sections.filter((section) => section.heading || section.body);
}

function extractField(content = "", labels = []) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = content.match(new RegExp(`(?:^|\\n)\\s*(?:[-*+]\\s*)?${escaped}\\s*[:：]\\s*(.+)`, "i"));
    if (match) return match[1].trim();
  }
  return "";
}

function extractUrl(content = "") {
  return content.match(/https?:\/\/[^\s)\]>]+/i)?.[0] || "";
}

function firstParagraph(content = "") {
  return content.split(/\n\s*\n/).map((part) => part.replace(/^[-*+]\s*/gm, "").trim()).find(Boolean) || "";
}

function splitList(value = "") {
  return value ? value.split(/[,，;；|]/).map((item) => item.trim()).filter(Boolean) : [];
}
