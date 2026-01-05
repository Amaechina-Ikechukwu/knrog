import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

// Change this to a function
export const getRandomName = () => uniqueNamesGenerator({
  dictionaries: [adjectives, animals],
  separator: '-',
});