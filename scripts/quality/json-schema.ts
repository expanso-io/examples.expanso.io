type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function resolveReference(
  rootSchema: JsonObject,
  reference: string
): JsonObject | null {
  if (!reference.startsWith('#/')) return null;
  let current: unknown = rootSchema;
  for (const rawPart of reference.slice(2).split('/')) {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObject(current) || !(part in current)) return null;
    current = current[part];
  }
  return isObject(current) ? current : null;
}

function validateNode(
  value: unknown,
  schema: JsonObject,
  location: string,
  rootSchema: JsonObject,
  errors: string[]
): void {
  if (typeof schema.$ref === 'string') {
    const target = resolveReference(rootSchema, schema.$ref);
    if (!target) {
      errors.push(`${location}: unresolved schema reference ${schema.$ref}`);
      return;
    }
    validateNode(value, target, location, rootSchema, errors);
    return;
  }

  if ('const' in schema && value !== schema.const) {
    errors.push(`${location} must equal ${JSON.stringify(schema.const)}`);
    return;
  }
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((entry) => entry === value)
  ) {
    errors.push(`${location} must be one of ${schema.enum.join(', ')}`);
    return;
  }

  if (schema.type === 'object') {
    if (!isObject(value)) {
      errors.push(`${location} must be an object`);
      return;
    }
    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter(
          (entry): entry is string => typeof entry === 'string'
        )
      : [];
    for (const field of required) {
      if (!(field in value))
        errors.push(`${location} is missing field ${field}`);
    }
    if (
      typeof schema.minProperties === 'number' &&
      Object.keys(value).length < schema.minProperties
    ) {
      errors.push(
        `${location} must contain at least ${schema.minProperties} properties`
      );
    }
    for (const field of Object.keys(value)) {
      if (field in properties) continue;
      if (schema.additionalProperties === false) {
        errors.push(`${location} has unknown field ${field}`);
      } else if (isObject(schema.additionalProperties)) {
        validateNode(
          value[field],
          schema.additionalProperties,
          `${location}.${field}`,
          rootSchema,
          errors
        );
      }
    }
    for (const [field, childSchema] of Object.entries(properties)) {
      if (field in value && isObject(childSchema)) {
        validateNode(
          value[field],
          childSchema,
          `${location}.${field}`,
          rootSchema,
          errors
        );
      }
    }
    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${location} must be an array`);
      return;
    }
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${location} must contain at least ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${location} must contain at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems === true) {
      const canonical = value.map((entry) => JSON.stringify(entry));
      if (new Set(canonical).size !== canonical.length) {
        errors.push(`${location} must contain unique items`);
      }
    }
    if (isObject(schema.items)) {
      value.forEach((entry, index) =>
        validateNode(
          entry,
          schema.items as JsonObject,
          `${location}[${index}]`,
          rootSchema,
          errors
        )
      );
    }
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${location} must be a string`);
      return;
    }
    if (
      typeof schema.minLength === 'number' &&
      value.length < schema.minLength
    ) {
      errors.push(`${location} must have length >= ${schema.minLength}`);
    }
    if (
      typeof schema.maxLength === 'number' &&
      value.length > schema.maxLength
    ) {
      errors.push(`${location} must have length <= ${schema.maxLength}`);
    }
    if (
      typeof schema.pattern === 'string' &&
      !new RegExp(schema.pattern).test(value)
    ) {
      errors.push(`${location} does not match ${schema.pattern}`);
    }
    if (schema.format === 'date-time') {
      const timestamp = new Date(value);
      if (
        !Number.isFinite(timestamp.valueOf()) ||
        timestamp.toISOString() !== value
      ) {
        errors.push(`${location} must be a canonical ISO 8601 timestamp`);
      }
    }
    return;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (schema.type === 'integer' && !Number.isInteger(value))
    ) {
      errors.push(`${location} must be a finite ${schema.type}`);
      return;
    }
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${location} must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${location} must be <= ${schema.maximum}`);
    }
    return;
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${location} must be a boolean`);
  }
}

export function validateJsonSchema(
  value: unknown,
  schema: unknown,
  location = 'value'
): string[] {
  if (!isObject(schema)) return [`${location}: schema must be an object`];
  const errors: string[] = [];
  validateNode(value, schema, location, schema, errors);
  return errors;
}
