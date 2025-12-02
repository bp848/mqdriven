import { ApplicationWithDetails } from '../types';

export interface ResubmissionMeta {
    resubmittedFromId: string;
    resubmittedAt?: string;
}

export const buildResubmissionMeta = (
    source?: ApplicationWithDetails | null
): ResubmissionMeta | null => {
    if (!source) return null;
    const existingReference: string | undefined =
        source.formData?.meta?.resubmittedFromId;
    const parentId =
        source.status === 'rejected'
            ? source.id
            : existingReference;

    if (!parentId) {
        return null;
    }

    return {
        resubmittedFromId: parentId,
        resubmittedAt: new Date().toISOString(),
    };
};

export const attachResubmissionMeta = (
    formData: any,
    meta: ResubmissionMeta | null
) => {
    if (!meta) return formData;
    return {
        ...(formData || {}),
        meta: {
            ...(formData?.meta || {}),
            ...meta,
        },
    };
};

export const summarizeResubmissionLinks = (
    apps: ApplicationWithDetails[]
): { parentIds: string[]; childMap: Record<string, string> } => {
    const parentIds = new Set<string>();
    const childMap: Record<string, string> = {};

    apps.forEach(app => {
        const parentId = app.formData?.meta?.resubmittedFromId;
        if (typeof parentId === 'string' && parentId.trim().length > 0) {
            parentIds.add(parentId);
            childMap[app.id] = parentId;
        }
    });

    return {
        parentIds: Array.from(parentIds),
        childMap,
    };
};
