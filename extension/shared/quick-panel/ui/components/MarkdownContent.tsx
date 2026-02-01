import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
    content: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
    return (
        <div className="text-[13px] leading-relaxed text-[var(--ac-text)] break-words space-y-2
            [&_p]:mb-2 [&_p:last-child]:mb-0
            [&_pre]:bg-[var(--ac-surface-muted)] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--ac-border)] [&_pre]:overflow-x-auto [&_pre]:my-2
            [&_code]:bg-[var(--ac-surface-muted)] [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs
            [&_a]:text-[var(--ac-link)] [&_a]:underline
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
            [&_li]:mb-1
            [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
            [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
            [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1
        ">
            <ReactMarkdown>
                {content}
            </ReactMarkdown>
        </div>
    );
};
