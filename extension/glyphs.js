/* Halo Drift 图标集：24×24 网格、1.7 线宽、圆角端点的原创线条图标。
 * 每个图标表示网站的用途（对话、笔记、论文、代码……），不使用任何品牌标志。 */
(() => {
  'use strict';

  const G = {
    // 星座：四颗星连成一条线
    constellation: { name: '星座', d: '<path d="M4.5 17.5 9 10l6 3.5 4.5-8"/><circle cx="4.5" cy="17.5" r="1.6" fill="#fff"/><circle cx="9" cy="10" r="1.6" fill="#fff"/><circle cx="15" cy="13.5" r="1.6" fill="#fff"/><circle cx="19.5" cy="5.5" r="2.1" fill="#fff"/>' },
    // 对话气泡
    bubble: { name: '对话', d: '<path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.5L7 21v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="8.5" cy="11.5" r="1" fill="#fff" stroke="none"/><circle cx="12" cy="11.5" r="1" fill="#fff" stroke="none"/><circle cx="15.5" cy="11.5" r="1" fill="#fff" stroke="none"/>' },
    // 羽毛笔
    quill: { name: '羽毛笔', d: '<path d="M20 3.5c-7.5.5-12.2 5-13.3 12.8 4.6-.3 8.6-2.5 10.6-6.4.4-.9.7-1.8.9-2.6-1 .3-2 .4-3 .3 2.1-1 3.7-2.3 4.8-4.1z"/><path d="M4 20.5 13 11.5"/>' },
    // 活页笔记本
    notebook: { name: '笔记本', d: '<rect x="6.5" y="3" width="13" height="18" rx="2.2"/><path d="M4 7.5h4.5M4 12h4.5M4 16.5h4.5M11 8.5h5.5M11 12h5.5M11 15.5h3.5"/>' },
    // 带公式的文档
    sigma: { name: '公式文档', d: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M14.5 12.5h-5l2.6 2.8-2.6 2.8h5"/>' },
    // 播放 + 飘过的弹幕
    danmaku: { name: '弹幕视频', d: '<path d="M10.5 6.2v11.6c0 .8.9 1.3 1.6.8l8.4-5.8c.6-.4.6-1.2 0-1.6l-8.4-5.8c-.7-.5-1.6 0-1.6.8z"/><path d="M2.5 8.5h5M3.5 12h4M2.5 15.5h5"/>' },
    // 一叠论文
    papers: { name: '论文', d: '<path d="M8 5.5V4.8A1.8 1.8 0 0 1 9.8 3h8.4A1.8 1.8 0 0 1 20 4.8v11.4a1.8 1.8 0 0 1-1.8 1.8h-.7"/><rect x="4" y="6.5" width="12" height="14.5" rx="1.8"/><path d="M7 11h6M7 14h6M7 17h3.5"/>' },
    // 代码分支
    branch: { name: '代码分支', d: '<circle cx="6.5" cy="5" r="2.2"/><circle cx="6.5" cy="19" r="2.2"/><circle cx="17.5" cy="8.5" r="2.2"/><path d="M6.5 7.2v9.6"/><path d="M17.5 10.7c0 4.2-3.3 5.3-6.6 5.6-1.9.2-3.5.7-4.2 1.6"/>' },
    // 引用符号
    quote: { name: '引用', d: '<circle cx="7.3" cy="14.3" r="2.9" fill="#fff"/><path d="M4.5 14.2C4.6 10.4 6.5 7.6 10.2 6.3"/><circle cx="16.3" cy="14.3" r="2.9" fill="#fff"/><path d="M13.5 14.2c.1-3.8 2-6.6 5.7-7.9"/>' },
    // 地球（网页搜索）
    globe: { name: '地球', d: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"/>' },
    // 指南针
    compass: { name: '指南针', d: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>' },
    // 粒子轨道
    atom: { name: '粒子', d: '<circle cx="12" cy="12" r="1.6" fill="#fff"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-30 12 12)"/>' },
    // 通用图标（自己添加的网站可选）
    code: { name: '代码', d: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>' },
    book: { name: '书', d: '<path d="M12 6.5C10.2 5 7.7 4.5 4 4.5v13c3.7 0 6.2.5 8 2 1.8-1.5 4.3-2 8-2v-13c-3.7 0-6.2.5-8 2z"/><path d="M12 6.5v13"/>' },
    mail: { name: '邮件', d: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>' },
    folder: { name: '文件夹', d: '<path d="M3 7.2A1.7 1.7 0 0 1 4.7 5.5h4.1l2 2.2h8.5A1.7 1.7 0 0 1 21 9.4v8.9a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3z"/>' },
    chart: { name: '图表', d: '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>' },
    image: { name: '图片', d: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="m21 16-5-5-8.5 8.5"/>' },
    music: { name: '音乐', d: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>' },
    cloud: { name: '云', d: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 18.5z"/>' },
    star: { name: '收藏', d: '<path d="m12 3.8 2.5 5.2 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z"/>' },
    cube: { name: '模型', d: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>' },
  };

  const svg = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${G[id].d}</svg>`;
  const url = (id) => `url("data:image/svg+xml,${encodeURIComponent(svg(id))}")`;

  // 常用网站默认对应的图标
  const HOSTS = [
    ['gemini.google.com', 'constellation'],
    ['chatgpt.com', 'bubble'],
    ['chat.openai.com', 'bubble'],
    ['claude.ai', 'quill'],
    ['notebooklm.google.com', 'notebook'],
    ['overleaf.com', 'sigma'],
    ['bilibili.com', 'danmaku'],
    ['arxiv.org', 'papers'],
    ['github.com', 'branch'],
    ['scholar.google', 'quote'],
    ['huggingface.co', 'cube'],
    ['openreview.net', 'book'],
    ['mail.google.com', 'mail'],
    ['drive.google.com', 'folder'],
  ];
  const forHost = (host) => {
    const h = (host || '').replace(/^www\./, '');
    const hit = HOSTS.find(([d]) => h === d || h.endsWith('.' + d) || h.startsWith(d + '.') || h.startsWith(d));
    return hit ? hit[1] : null;
  };

  // 彩色图标（logos 文件夹，由用户提供），tint 用来给圆形底座染色
  const LOGOS = {
    gemini:     { name: 'Gemini',     tint: '#5591f7' },
    openreview: { name: 'OpenReview', tint: '#b9c1e6' },
    overleaf:   { name: 'Overleaf',   tint: '#4cc599' },
    claude:     { name: 'Claude',     tint: '#e98568' },
    bilibili:   { name: '哔哩哔哩',   tint: '#f070a7' },
    arxiv:      { name: 'arXiv',      tint: '#c54e55' },
    github:     { name: 'GitHub',     tint: '#a9b0e8' },
    scholar:    { name: 'Scholar',    tint: '#6b96f4' },
    gpt:        { name: 'GPT',        tint: '#4dd8d9' },
  };
  const LOGO_HOSTS = [
    ['gemini.google.com', 'gemini'],
    ['openreview.net', 'openreview'],
    ['overleaf.com', 'overleaf'],
    ['claude.ai', 'claude'],
    ['bilibili.com', 'bilibili'],
    ['arxiv.org', 'arxiv'],
    ['github.com', 'github'],
    ['scholar.google', 'scholar'],
    ['chatgpt.com', 'gpt'],
    ['chat.openai.com', 'gpt'],
  ];
  const logoForHost = (host) => {
    const h = (host || '').replace(/^www\./, '');
    const hit = LOGO_HOSTS.find(([d]) => h === d || h.endsWith('.' + d) || h.startsWith(d));
    return hit ? hit[1] : null;
  };
  const logoSrc = (id) => `logos/${id}.png`;

  window.AURORA_GLYPHS = { list: G, svg, url, forHost, logos: LOGOS, logoForHost, logoSrc };
})();
