// "1 tool", "2 tools"
export const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`
