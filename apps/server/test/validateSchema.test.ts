import { describe, expect, it } from 'vitest';
import { validateSchema } from '../src/api/validation/validateSchema.js';

const person = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 5 },
    age: { type: 'integer', minimum: 0, maximum: 120 },
    nick: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    kind: { enum: ['a', 'b'] },
    flag: { type: 'boolean' },
  },
  required: ['name'],
  additionalProperties: false,
  minProperties: 1,
} as const;

describe('validateSchema', () => {
  it('accepts a valid value and applies defaults', () => {
    const result = validateSchema(person, { name: 'Ann' });
    expect(result.violation).toBeUndefined();
    expect(result.value).toEqual({ name: 'Ann' });
    const defaulted = validateSchema(
      { type: 'object', properties: { limit: { type: 'integer', default: 100 } } },
      {},
    );
    expect(defaulted.value).toEqual({ limit: 100 });
  });

  it('converts text to numbers and booleans, a list of one to its item and a value to a list', () => {
    const result = validateSchema(person, {
      name: 'Ann',
      age: '42',
      flag: 'true',
      tags: 'x',
      nick: 7,
    });
    expect(result.value).toMatchObject({ age: 42, flag: true, tags: ['x'], nick: '7' });
    expect(validateSchema(person, { name: ['Bo'] }).value).toMatchObject({ name: 'Bo' });
  });

  it('reports the first broken rule like the clients already see it', () => {
    expect(validateSchema(person, {}).violation).toEqual({
      instancePath: '',
      schemaPath: '#/minProperties',
      keyword: 'minProperties',
      params: { limit: 1 },
      message: 'must NOT have fewer than 1 properties',
    });
    expect(validateSchema(person, { age: 1 }).violation).toMatchObject({
      keyword: 'required',
      params: { missingProperty: 'name' },
    });
    expect(validateSchema(person, { name: 'a', extra: 1 }).violation).toMatchObject({
      keyword: 'additionalProperties',
      params: { additionalProperty: 'extra' },
    });
    expect(validateSchema(person, { name: 'toolong' }).violation).toMatchObject({
      instancePath: '/name',
      schemaPath: '#/properties/name/maxLength',
      message: 'must NOT have more than 5 characters',
    });
    expect(validateSchema(person, { name: 'a', age: 1.5 }).violation).toMatchObject({
      keyword: 'type',
      message: 'must be integer',
    });
    expect(validateSchema(person, { name: 'a', age: 200 }).violation).toMatchObject({
      message: 'must be <= 120',
    });
    expect(validateSchema(person, { name: 'a', kind: 'c' }).violation).toMatchObject({
      message: 'must be equal to one of the allowed values',
    });
    expect(validateSchema(person, { name: 'a', tags: [1, {}] }).violation).toMatchObject({
      instancePath: '/tags/1',
    });
    expect(validateSchema(person, { name: 'a', nick: {} }).violation).toMatchObject({
      message: 'must be string,null',
    });
  });

  it('rejects a value that is not an object', () => {
    expect(validateSchema(person, undefined).violation).toMatchObject({
      message: 'must be object',
    });
    expect(validateSchema(person, null).violation).toMatchObject({ message: 'must be object' });
  });
});
