/** Values supported by the YAML pipeline files and JSON API payloads. */
export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | YamlObject;

export interface YamlObject {
  [key: string]: YamlValue;
}

export function isYamlObject(value: YamlValue): value is YamlObject {
  return value !== null && !Array.isArray(value) && value instanceof Object;
}

export function isStringValue(value: YamlValue | undefined): value is string {
  return value?.constructor === String;
}

export function isNumberValue(value: YamlValue | undefined): value is number {
  return value?.constructor === Number;
}
