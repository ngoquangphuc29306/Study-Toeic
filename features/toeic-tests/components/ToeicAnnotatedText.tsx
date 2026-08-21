'use client';

import type { ToeicTextAnnotation } from '../toolContracts';
import { splitAnnotatedText } from '../services/toeicAnnotationAnchoring';

export function ToeicAnnotatedText({ text, annotations }: { text: string; annotations: ReadonlyArray<ToeicTextAnnotation> }) {
  const { segments } = splitAnnotatedText(text, annotations);
  return <>{segments.map((segment, index) => segment.annotation ? <mark key={`${segment.annotation.id}-${index}`} title={segment.annotation.comment ?? undefined} className={segment.annotation.style === 'underline' ? 'bg-transparent text-inherit underline decoration-2 decoration-[#F472B6] underline-offset-4' : 'rounded bg-[#FEF3C7] text-inherit'}>{segment.text}</mark> : <span key={`text-${index}`}>{segment.text}</span>)}</>;
}
