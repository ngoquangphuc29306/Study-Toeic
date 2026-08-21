import type {
  CreateToeicAnnotatorAnnotationInput,
  ToeicAnnotationGeometry,
  ToeicAnnotationType,
} from '../toolContracts';

export const TOEIC_ANNOTATION_TYPES: ReadonlyArray<ToeicAnnotationType> = [
  'highlight', 'underline', 'pen', 'text', 'sticky', 'rectangle', 'arrow',
];

export const TOEIC_ANNOTATION_COLORS = ['#FDE68A', '#F472B6', '#60A5FA', '#34D399', '#A78BFA', '#1F2937'] as const;

export function isToeicAnnotationType(value: string): value is ToeicAnnotationType {
  return TOEIC_ANNOTATION_TYPES.includes(value as ToeicAnnotationType);
}

export function isToeicAnnotationColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function isToeicAnnotationPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && Number.isFinite(point.x) && point.x >= 0 && point.x <= 1 &&
    typeof point.y === 'number' && Number.isFinite(point.y) && point.y >= 0 && point.y <= 1;
}

export function isToeicAnnotationGeometry(value: unknown): value is ToeicAnnotationGeometry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const geometry = value as Record<string, unknown>;
  const number = (key: string) => typeof geometry[key] === 'number' && Number.isFinite(geometry[key]) && (geometry[key] as number) >= 0 && (geometry[key] as number) <= 1;
  if (geometry.kind === 'freehand') return Array.isArray(geometry.points) && geometry.points.length >= 2 && geometry.points.length <= 500 && geometry.points.every(isToeicAnnotationPoint);
  if (geometry.kind === 'box') return number('x') && number('y') && number('width') && number('height') && (geometry.width as number) > 0 && (geometry.height as number) > 0 && (geometry.x as number) + (geometry.width as number) <= 1 && (geometry.y as number) + (geometry.height as number) <= 1;
  if (geometry.kind === 'arrow') return number('x1') && number('y1') && number('x2') && number('y2');
  return false;
}

export function validateToeicAnnotatorInput(input: CreateToeicAnnotatorAnnotationInput): void {
  if (!isToeicAnnotationType(input.annotationType)) throw new Error('Loại annotator không hợp lệ.');
  if (!isToeicAnnotationColor(input.color)) throw new Error('Màu annotator không hợp lệ.');
  if (!Number.isInteger(input.strokeWidth) || input.strokeWidth < 1 || input.strokeWidth > 12) throw new Error('Độ dày nét không hợp lệ.');
  const isText = input.annotationType === 'highlight' || input.annotationType === 'underline';
  if (isText && (!input.quote.trim() || input.quote.length > 1000 || input.endOffset <= input.startOffset)) throw new Error('Đoạn văn bản annotator không hợp lệ.');
  if (!isText && !input.geometry) throw new Error('Hình annotator không hợp lệ.');
  if (input.geometry && !isToeicAnnotationGeometry(input.geometry)) throw new Error('Hình annotator không hợp lệ.');
  if ((input.annotationType === 'text' || input.annotationType === 'sticky') && (!input.textContent?.trim() || input.textContent.length > 500)) throw new Error('Nội dung annotator không hợp lệ.');
  if (input.textContent && input.textContent.length > 500) throw new Error('Nội dung annotator quá dài.');
}

export function annotationTypeToStyle(type: ToeicAnnotationType): 'highlight' | 'underline' {
  return type === 'underline' ? 'underline' : 'highlight';
}
