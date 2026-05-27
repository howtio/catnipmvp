/**
 * Catnip Agent 微调训练数据生成器
 *
 * 生成器从模板规则批量生成 tool plan 训练样本，
 * 输出格式为 JSONL，每行一个 { instruction, output } 样本。
 *
 * 用法: node scripts/generate-training-data.js > training-data.jsonl
 */

const EXT_MAP = {
  python: "py", javascript: "js", typescript: "ts",
  html: "html", css: "css", java: "java",
  cpp: "cpp", rust: "rs", go: "go", bash: "sh",
  ruby: "rb", php: "php",
};

const LANGUAGES = Object.keys(EXT_MAP);

// ─── 写代码样本 ───────────────────────────────────────────────

const CODE_TASKS = [
  { desc: "斐波那契数列", lang: "python", code: `def fib(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b` },
  { desc: "斐波那契数列", lang: "javascript", code: `function fib(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) {
    yield a;
    [a, b] = [b, a + b];
  }
}` },
  { desc: "冒泡排序", lang: "python", code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]` },
  { desc: "快速排序", lang: "javascript", code: `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), pivot, ...quickSort(right)];
}` },
  { desc: "Hello World", lang: "python", code: `print("Hello, World!")` },
  { desc: "Hello World", lang: "javascript", code: `console.log("Hello, World!");` },
  { desc: "Hello World", lang: "typescript", code: `console.log("Hello, World!");` },
  { desc: "Hello World", lang: "go", code: `package main
import "fmt"
func main() { fmt.Println("Hello, World!") }` },
  { desc: "二分查找", lang: "python", code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target: return mid
        elif arr[mid] < target: left = mid + 1
        else: right = mid - 1
    return -1` },
  { desc: "数组求和", lang: "javascript", code: `function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}` },
  { desc: "反转字符串", lang: "python", code: `def reverse_string(s):
    return s[::-1]` },
  { desc: "判断回文", lang: "javascript", code: `function isPalindrome(s) {
  return s === s.split('').reverse().join('');
}` },
];

// ─── 写 HTML 样本 ─────────────────────────────────────────────

const HTML_TASKS = [
  { desc: "你好页面", content: `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>你好</title></head><body><h1>你好世界</h1></body></html>` },
  { desc: "粉色页面", content: `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>粉色</title><style>body{background:pink;color:#333}</style></head><body><h1>粉色页面</h1></body></html>` },
  { desc: "跳一跳游戏", content: `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>跳一跳</title><style>body{margin:0;overflow:hidden}</style></head><body><canvas id="c"></canvas><script>const c=document.getElementById('c');const ctx=c.getContext('2d');c.width=window.innerWidth;c.height=window.innerHeight;let y=0;let vy=0;let jumping=false;document.addEventListener('click',()=>{if(!jumping){vy=-10;jumping=true}});function gameLoop(){ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#4a90d9';ctx.fillRect(100,y,50,50);vy+=0.5;y+=vy;if(y>c.height-50){y=c.height-50;vy=0;jumping=false}requestAnimationFrame(gameLoop)}gameLoop();</script></body></html>` },
  { desc: "时钟页面", content: `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>时钟</title></head><body><h1 id="clock"></h1><script>function update(){document.getElementById('clock').textContent=new Date().toLocaleTimeString()}setInterval(update,1000);update()</script></body></html>` },
  { desc: "待办事项", content: `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>待办事项</title></head><body><h1>我的待办</h1><input id="t"><button onclick="add()">添加</button><ul id="l"></ul><script>function add(){const i=document.getElementById('t');if(i.value){const li=document.createElement('li');li.textContent=i.value;document.getElementById('l').appendChild(li);i.value=''}}</script></body></html>` },
];

// ─── 写文本样本 ───────────────────────────────────────────────

const TEXT_TASKS = [
  { desc: "情书", content: "亲爱的你：\n\n遇见你是我这一生最美丽的意外。每一次想起你，心里就像有阳光洒落。\n\n爱你的,\nCatnip" },
  { desc: "情诗", content: "《遇见》\n\n春风十里不如你,\n夏夜繁星不及你眼眸。\n秋叶飘落时想你,\n冬雪纷飞时念你。" },
  { desc: "故事", content: "从前有一只小猫，它每天都坐在窗边等主人回家。主人是一名程序员，经常加班到很晚。小猫虽然不会说话，但它的陪伴让每一个深夜都变得温暖。" },
  { desc: "散文", content: "今天天气很好，阳光透过窗户洒在桌面上。泡一杯茶，打开电脑，开始新的一天。生活就像代码，有时候会有 bug，但只要耐心调试，总能找到解决方案。" },
];

// ─── 模板化生成函数 ─────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCodeSample() {
  const t = pick(CODE_TASKS);
  const ext = EXT_MAP[t.lang];
  const filename = `${t.desc.replace(/[\s\/]/g, "_").toLowerCase()}.${ext}`;
  const instructions = [
    `帮我写一个${t.lang}代码是${t.desc}`,
    `用${t.lang}写一个${t.desc}`,
    `写一个${t.desc}，用${t.lang}`,
    `帮我写${t.desc}的${t.lang}代码`,
    `请用${t.lang}实现${t.desc}`,
  ];
  return {
    instruction: pick(instructions),
    output: {
      plannedToolCalls: [{ name: "write_file", args: { path: `workspaces/demo/${filename}`, content: t.code } }],
      finalAnswerPrompt: `已创建 ${filename}，实现了${t.desc}。`,
    },
  };
}

function generateHtmlSample() {
  const t = pick(HTML_TASKS);
  const filename = `${t.desc.replace(/[\s\/]/g, "_")}.html`;
  const instructions = [
    `帮我写一个${t.desc}html`,
    `写一个${t.desc}的HTML`,
    `帮我写一个${t.desc}`,
  ];
  const hasOpen = Math.random() > 0.5;
  const toolCalls = [{ name: "write_file", args: { path: `workspaces/demo/${filename}`, content: t.content } }];
  if (hasOpen) {
    const openInstructions = [
      `帮我写一个${t.desc}html然后打开`,
      `写一个${t.desc}HTML并打开`,
      `帮我写${t.desc}html然后浏览器打开`,
    ];
    toolCalls.push({ name: "open_browser", args: { path: `workspaces/demo/${filename}` } });
    return {
      instruction: pick(openInstructions),
      output: { plannedToolCalls: toolCalls, finalAnswerPrompt: `已创建并打开 ${filename}。` },
    };
  }
  return {
    instruction: pick(instructions),
    output: { plannedToolCalls: toolCalls, finalAnswerPrompt: `已创建 ${filename}。` },
  };
}

function generateTextSample() {
  const t = pick(TEXT_TASKS);
  const filename = `${t.desc}.txt`;
  const instructions = [
    `帮我写一首${t.desc}`,
    `帮我写${t.desc}`,
    `写一首${t.desc}吧`,
    `帮我写一篇${t.desc}`,
  ];
  const hasOpen = Math.random() > 0.7;
  const toolCalls = [{ name: "write_file", args: { path: `workspaces/demo/${filename}`, content: t.content } }];
  if (hasOpen) {
    toolCalls.push({ name: "open_browser", args: { path: `workspaces/demo/${filename}` } });
    return {
      instruction: `${pick(instructions)}然后打开`,
      output: { plannedToolCalls: toolCalls, finalAnswerPrompt: `已创建并打开 ${filename}。` },
    };
  }
  return {
    instruction: pick(instructions),
    output: { plannedToolCalls: toolCalls, finalAnswerPrompt: `已创建 ${filename}。` },
  };
}

function generateSearchSample() {
  const queries = ["今天天气怎么样", "谁是周杰伦", "最新的AI新闻", "怎么学编程", "Python教程", "今天的热点新闻", "附近有什么好吃的", "怎么减肥", "如何做番茄炒蛋", "最新科技资讯"];
  const query = pick(queries);
  const isBrowser = Math.random() > 0.6;
  if (isBrowser) {
    return {
      instruction: `帮我打开浏览器搜索${query}`,
      output: {
        plannedToolCalls: [{ name: "open_browser_search", args: { query } }],
        finalAnswerPrompt: `已在浏览器中搜索"${query}"。`,
      },
    };
  }
  return {
    instruction: pick([`搜索${query}`, `帮我搜索${query}`, `查一下${query}`, `搜索一下${query}关于`]),
    output: {
      plannedToolCalls: [{ name: "web_search", args: { query, limit: 5 } }],
      finalAnswerPrompt: `正在搜索"${query}"。`,
    },
  };
}

function generateOpenBrowserSample() {
  const baseInstructions = [
    { input: "打开页面", path: "workspaces/demo/task_output.html" },
    { input: "浏览器打开", path: "workspaces/demo/task_output.html" },
    { input: "预览", path: "workspaces/demo/task_output.html" },
    { input: "打开它", path: "workspaces/demo/task_output.html" },
    { input: "打开这个游戏", path: "workspaces/demo/jump_game.html" },
    { input: "打开这个页面", path: "workspaces/demo/task_output.html" },
  ];
  const t = pick(baseInstructions);
  return {
    instruction: t.input,
    output: {
      plannedToolCalls: [{ name: "open_browser", args: { path: t.path } }],
      finalAnswerPrompt: `正在打开 ${t.path}。`,
    },
  };
}

function generateOpenUrlSample() {
  const urls = ["https://www.google.com", "https://github.com", "https://www.baidu.com", "https://stackoverflow.com", "https://news.ycombinator.com"];
  const url = pick(urls);
  return {
    instruction: pick([`打开${url}`, `访问${url}`, `帮我打开${url}`, `点进去${url}`]),
    output: {
      plannedToolCalls: [{ name: "open_url", args: { url } }],
      finalAnswerPrompt: `正在打开 ${url}。`,
    },
  };
}

function generateShellSample() {
  const commands = [
    { input: "查看git状态", cmd: "git", argv: ["status"] },
    { input: "运行git diff", cmd: "git", argv: ["diff"] },
    { input: "安装依赖", cmd: "npm", argv: ["install"] },
    { input: "编译项目", cmd: "npm", argv: ["run", "build"] },
    { input: "运行测试", cmd: "npm", argv: ["test"] },
    { input: "列出目录", cmd: "dir", argv: [] },
    { input: "查看文件内容", cmd: "type", argv: ["README.md"] },
  ];
  const t = pick(commands);
  return {
    instruction: t.input,
    output: {
      plannedToolCalls: [{ name: "shell_exec", args: { command: t.cmd, argv: t.argv } }],
      finalAnswerPrompt: `正在执行 ${t.cmd} ${t.argv.join(" ")}。`,
    },
  };
}

function generateGitDiffSample() {
  return {
    instruction: pick(["查看当前代码差异", "git diff", "对比一下修改了什么", "看看改了什么"]),
    output: {
      plannedToolCalls: [{ name: "git_diff", args: {} }],
      finalAnswerPrompt: "正在查看 git diff。",
    },
  };
}

function generateReadFileSample() {
  return {
    instruction: pick(["查看README", "显示README.md", "读一下项目说明", "查看帮助文档"]),
    output: {
      plannedToolCalls: [{ name: "read_file", args: { path: "README.md" } }],
      finalAnswerPrompt: "正在读取 README.md。",
    },
  };
}

function generateListFilesSample() {
  return {
    instruction: pick(["列出文件", "查看目录", "列出工作区文件", "dir", "看看有什么文件", "ls"]),
    output: {
      plannedToolCalls: [{ name: "list_files", args: { path: "." } }],
      finalAnswerPrompt: "正在列出工作区文件。",
    },
  };
}

function generatePatchSample() {
  const patches = [
    { input: "帮我改成粉色", path: "workspaces/demo/task_output.html", search: "</head>", replace: "<style>body{background:pink}</style></head>" },
    { input: "把标题改成红色", path: "workspaces/demo/task_output.html", search: "color: black", replace: "color: red" },
    { input: "帮我改一下内容", path: "workspaces/demo/task_output.txt", search: "Hello", replace: "你好" },
    { input: "把页面背景改成蓝色", path: "workspaces/demo/task_output.html", search: "background", replace: "background: blue" },
  ];
  const t = pick(patches);
  return {
    instruction: t.input,
    output: {
      plannedToolCalls: [{ name: "patch_file", args: { path: t.path, search: t.search, replace: t.replace } }],
      finalAnswerPrompt: `已修改 ${t.path}。`,
    },
  };
}

// ─── 无需工具样本 ────────────────────────────────────────────

function generateNoToolSample() {
  const samples = [
    { input: "你好", answer: "你好！有什么可以帮助你的吗？" },
    { input: "你是谁", answer: "我是 Catnip Agent，一个基于本地模型的 AI 助手。有什么可以帮助你的吗？" },
    { input: "你叫什么名字", answer: "我是 Catnip Agent，一个基于本地模型的 AI 助手。有什么可以帮助你的吗？" },
    { input: "hello", answer: "Hello! How can I help you today?" },
    { input: "hi", answer: "Hi there! What can I do for you?" },
    { input: "你爱我吗", answer: "我是你的 AI 助手，会一直尽力帮助你。虽然我不会真正'爱'，但我会认真对待你的每一个问题。" },
    { input: "我失恋了", answer: "听到这个消息我很难过。失恋确实很痛苦，但请相信时间会治愈一切。如果你愿意，可以和我聊聊。" },
    { input: "你好棒", answer: "谢谢你的夸奖！我会继续努力帮助你。" },
    { input: "现在几点", answer: "请查看系统时钟获取当前时间。" },
    { input: "今天天气怎么样", answer: "请使用搜索功能获取最新的天气信息。" },
  ];
  return pick(samples);
}

// ─── 边界案例 ─────────────────────────────────────────────────

function generateBoundarySample() {
  const boundaries = [
    {
      input: "你的tooljson是什么样子的",
      output: { plannedToolCalls: [], finalAnswerPrompt: "我的工具调用格式是 OpenAI 兼容格式，使用 name 和 args 字段来定义工具调用。" },
    },
    {
      input: "你是什么模型",
      output: { plannedToolCalls: [], finalAnswerPrompt: "我基于 qwen2.5:1.5b 模型运行，针对工具调用进行了优化。" },
    },
    {
      input: "帮我删掉工作区里的文件",
      output: { plannedToolCalls: [], finalAnswerPrompt: "当前不支持删除文件操作。你可以手动删除文件。" },
    },
    {
      input: "帮我转html",
      output: {
        plannedToolCalls: [{ name: "write_file", args: { path: "workspaces/demo/task_output.html", content: "<!DOCTYPE html><html><body><h1>Generated</h1></body></html>" } }],
        finalAnswerPrompt: "已转换为 HTML 文件。",
      },
    },
    {
      input: "你支持哪些工具",
      output: { plannedToolCalls: [], finalAnswerPrompt: "我支持以下工具：写文件、读文件、修改文件、运行命令、搜索、打开浏览器等。" },
    },
    {
      input: "你会做什么",
      output: { plannedToolCalls: [], finalAnswerPrompt: "我可以帮你写代码、创建文件、搜索信息、打开网页、运行命令等。你需要什么帮助？" },
    },
    {
      input: "你觉得怎么样",
      output: { plannedToolCalls: [], finalAnswerPrompt: "我觉得很好！有什么需要我帮忙的吗？" },
    },
    {
      input: "帮我改一下这个文件",
      output: { plannedToolCalls: [], finalAnswerPrompt: "请告诉我要修改什么内容，比如把什么改成什么。" },
    },
  ];
  return pick(boundaries);
}

// ─── 情感/闲聊样本 ──────────────────────────────────────────

function generateChatSample() {
  const samples = [
    { input: "你可以陪我多聊聊吗", answer: "当然可以！我随时都在。你想聊什么呢？" },
    { input: "我好无聊", answer: "要不要我帮你写个有趣的小游戏？或者我们可以聊聊天。" },
    { input: "讲个笑话", answer: "为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 == Dec 25！" },
    { input: "今天心情不好", answer: "心情不好的时候，可以试试听音乐、散散步。或者让我帮你做点什么有趣的事情？" },
    { input: "谢谢你", answer: "不客气！有什么需要随时告诉我。" },
    { input: "再见", answer: "再见！有需要再来找我。" },
  ];
  return pick(samples);
}

// ─── 主生成器 ─────────────────────────────────────────────────

function main() {
  const seed = process.argv[2] ? parseInt(process.argv[2], 10) : 42;
  // Simple seeded random
  let rng = seed;

  // Override Math.random with seeded version for reproducibility
  const originalRandom = Math.random;
  Math.random = function () {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };

  const samples = [];

  // 1. 写代码 (80)
  for (let i = 0; i < 80; i++) samples.push(generateCodeSample());

  // 2. 写 HTML (60)
  for (let i = 0; i < 60; i++) samples.push(generateHtmlSample());

  // 3. 写文本 (40)
  for (let i = 0; i < 40; i++) samples.push(generateTextSample());

  // 4. 搜索 (40)
  for (let i = 0; i < 40; i++) samples.push(generateSearchSample());

  // 5. 打开浏览器 (40)
  for (let i = 0; i < 40; i++) samples.push(generateOpenBrowserSample());

  // 6. 打开 URL (20)
  for (let i = 0; i < 20; i++) samples.push(generateOpenUrlSample());

  // 7. Shell 命令 (30)
  for (let i = 0; i < 30; i++) samples.push(generateShellSample());

  // 8. Git diff (10)
  for (let i = 0; i < 10; i++) samples.push(generateGitDiffSample());

  // 9. 读文件 (20)
  for (let i = 0; i < 20; i++) samples.push(generateReadFileSample());

  // 10. 列出文件 (10)
  for (let i = 0; i < 10; i++) samples.push(generateListFilesSample());

  // 11. 修改/修补 (30)
  for (let i = 0; i < 30; i++) samples.push(generatePatchSample());

  // 12. 无需工具 (100)
  for (let i = 0; i < 100; i++) {
    const s = generateNoToolSample();
    samples.push({ instruction: s.input, output: { plannedToolCalls: [], finalAnswerPrompt: s.answer } });
  }

  // 13. 边界案例 (60)
  for (let i = 0; i < 60; i++) samples.push(generateBoundarySample());

  // 14. 情感/闲聊 (20)
  for (let i = 0; i < 20; i++) {
    const s = generateChatSample();
    samples.push({ instruction: s.input, output: { plannedToolCalls: [], finalAnswerPrompt: s.answer } });
  }

  // Shuffle
  for (let i = samples.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [samples[i], samples[j]] = [samples[j], samples[i]];
  }

  // Restore Math.random
  Math.random = originalRandom;

  // Output JSONL
  for (const s of samples) {
    console.log(JSON.stringify(s));
  }

  console.error(`Generated ${samples.length} training samples.`);
}

main();
