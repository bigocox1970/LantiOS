"use client";

import { type Dispatch, type SetStateAction } from "react";
import { Table2 } from "lucide-react";
import { RowActions } from "@/app/components/shared/RowActions";
import type { MikeDocument, TabularReview } from "@/app/components/shared/types";
import { CHECK_W, formatDate, NAME_COL_W } from "./ProjectPageParts";

export function ProjectReviewsTab({
    docs,
    reviews,
    filteredReviews,
    selectedReviewIds,
    allReviewsSelected,
    someReviewsSelected,
    renamingReviewId,
    renameReviewValue,
    creatingReview,
    currentUserId,
    onCreateReview,
    onOpenReview,
    onDeleteReview,
    onOwnerOnlyAction,
    submitReviewRename,
    setSelectedReviewIds,
    setRenamingReviewId,
    setRenameReviewValue,
}: {
    docs: MikeDocument[];
    reviews: TabularReview[];
    filteredReviews: TabularReview[];
    selectedReviewIds: string[];
    allReviewsSelected: boolean;
    someReviewsSelected: boolean;
    renamingReviewId: string | null;
    renameReviewValue: string;
    creatingReview: boolean;
    currentUserId?: string | null;
    onCreateReview: () => void;
    onOpenReview: (reviewId: string) => void;
    onDeleteReview: (review: TabularReview) => Promise<void> | void;
    onOwnerOnlyAction: (action: string) => void;
    submitReviewRename: (reviewId: string) => Promise<void> | void;
    setSelectedReviewIds: Dispatch<SetStateAction<string[]>>;
    setRenamingReviewId: Dispatch<SetStateAction<string | null>>;
    setRenameReviewValue: Dispatch<SetStateAction<string>>;
}) {
    return (
        <>
            <div className="flex items-center h-8 pr-8 border-b border-border text-xs text-muted-foreground font-medium select-none">
                <div
                    className={`sticky left-0 z-[60] ${CHECK_W} relative bg-card flex items-center justify-center self-stretch before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-card`}
                >
                    <input
                        type="checkbox"
                        checked={allReviewsSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someReviewsSelected;
                        }}
                        onChange={() => {
                            if (allReviewsSelected) setSelectedReviewIds([]);
                            else
                                setSelectedReviewIds(
                                    filteredReviews.map((r) => r.id),
                                );
                        }}
                        className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-black"
                    />
                </div>
                <div
                    className={`sticky left-8 z-[60] ${NAME_COL_W} bg-card pl-2 text-left`}
                >
                    Name
                </div>
                <div className="ml-auto w-24 shrink-0 text-left">Columns</div>
                <div className="w-24 shrink-0 text-left">Documents</div>
                <div className="w-32 shrink-0 text-left">Created</div>
                <div className="w-8 shrink-0" />
            </div>
            {reviews.length === 0 ? (
                <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
                    <Table2 className="h-8 w-8 text-muted-foreground/50 mb-4" />
                    <p className="text-2xl font-medium font-serif text-foreground">
                        Tabular Reviews
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs">
                        Extract data from project documents into tables using AI.
                    </p>
                    <button
                        onClick={onCreateReview}
                        disabled={creatingReview || docs.length === 0}
                        className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-md disabled:opacity-40"
                    >
                        + Create New
                    </button>
                </div>
            ) : (
                <div>
                    {filteredReviews.map((review) => (
                        <div
                            key={review.id}
                            onClick={() => {
                                if (renamingReviewId === review.id) return;
                                onOpenReview(review.id);
                            }}
                            className="group flex items-center h-10 pr-8 border-b border-border/40 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                            <div
                                className={`sticky left-0 z-[60] ${CHECK_W} p-2 flex items-center justify-center ${
                                    selectedReviewIds.includes(review.id)
                                        ? "bg-muted/50"
                                        : "bg-card"
                                } group-hover:bg-muted/50`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedReviewIds.includes(review.id)}
                                    onChange={() =>
                                        setSelectedReviewIds((prev) =>
                                            prev.includes(review.id)
                                                ? prev.filter(
                                                      (x) => x !== review.id,
                                                  )
                                                : [...prev, review.id],
                                        )
                                    }
                                    className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-black"
                                />
                            </div>
                            <div
                                className={`sticky left-8 z-[60] ${NAME_COL_W} bg-card p-2 group-hover:bg-muted/50`}
                            >
                                {renamingReviewId === review.id ? (
                                    <input
                                        autoFocus
                                        value={renameReviewValue}
                                        onChange={(e) =>
                                            setRenameReviewValue(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                void submitReviewRename(review.id);
                                            if (e.key === "Escape")
                                                setRenamingReviewId(null);
                                        }}
                                        onBlur={() =>
                                            void submitReviewRename(review.id)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-sm text-foreground/90 bg-transparent outline-none"
                                    />
                                ) : (
                                    <span className="text-sm text-foreground/90 truncate block">
                                        {review.title ?? "Untitled Review"}
                                    </span>
                                )}
                            </div>
                            <div className="ml-auto w-24 shrink-0 text-sm text-muted-foreground truncate">
                                {review.columns_config?.length ?? 0}
                            </div>
                            <div className="w-24 shrink-0 text-sm text-muted-foreground truncate">
                                {review.document_count ?? 0}
                            </div>
                            <div className="w-32 shrink-0 text-sm text-muted-foreground truncate">
                                {review.created_at ? (
                                    formatDate(review.created_at)
                                ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                )}
                            </div>
                            <div
                                className="w-8 shrink-0 flex justify-end"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <RowActions
                                    onRename={() => {
                                        if (
                                            currentUserId &&
                                            review.user_id !== currentUserId
                                        ) {
                                            onOwnerOnlyAction(
                                                "rename this tabular review",
                                            );
                                            return;
                                        }
                                        setRenameReviewValue(
                                            review.title ?? "Untitled Review",
                                        );
                                        setRenamingReviewId(review.id);
                                    }}
                                    onDelete={() => onDeleteReview(review)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
