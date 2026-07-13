import { bankA } from './reflection-bank-a.js';
import { bankB } from './reflection-bank-b.js';

export const reflectionBank = Object.freeze({ ...bankA, ...bankB });
