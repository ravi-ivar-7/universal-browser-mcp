/**
 * 随机 Loading 文案
 * 用于 TimelineStatusStep 组件展示趣味等待提示
 */

export const RANDOM_LOADING_TEXTS = [
  // Classic / Professional
  'Thinking through the logic...',
  'Analyzing the requirements...',
  'Processing data...',
  'Formulating the best response...',
  'Consulting specialized knowledge...',
  'Crafting the solution...',
  'Reviewing context...',
  'Almost there...',

  // Fun / Creative
  'Connecting the dots...',
  'Brewing some code coffee...',
  'Asking the digital oracle...',
  'Untangling the spaghetti code...',
  'Generating brilliance...',
  'Calculating the meaning of life...',
  'Consulting the rubber duck...',
  'Warming up the GPU...',
  'Spinning up the warp drive...',
  'Downloading more RAM...',

  // Tech / Geeky
  'Parsing the matrix...',
  'Compiling thoughts...',
  'Debugging reality...',
  'Indexing the internet...',
  'Traversing the graph...',
  'Optimizing neural pathways...',
  'Executing instruction set...',
  'Syncing with the cloud...',

  // Action Oriented
  'Writing code at light speed...',
  'Assembling your answer...',
  'Fetching the perfect solution...',
  'Putting the pieces together...',
  'Finalizing the output...',
  'Formatting results...',
  'Polishing the details...',
];

/**
 * 获取随机 Loading 文案
 */
export function getRandomLoadingText(): string {
  return RANDOM_LOADING_TEXTS[Math.floor(Math.random() * RANDOM_LOADING_TEXTS.length)];
}
