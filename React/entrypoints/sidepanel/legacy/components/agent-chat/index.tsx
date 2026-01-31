import React from 'react';

export const AgentChatShell = ({ children }: any) => <div className="flex flex-col h-full">{children}</div>;
export const AgentTopBar = (props: any) => <div className="border-b p-2">Agent Top Bar</div>;
export const AgentComposer = (props: any) => <div className="border-t p-2">Composer</div>;
export const AgentConversation = (props: any) => <div className="flex-1 p-2">Conversation</div>;
export const AgentProjectMenu = (props: any) => props.open ? <div className="fixed inset-0 bg-white z-50 p-4">Project Menu</div> : null;
export const AgentSessionMenu = (props: any) => props.open ? <div className="fixed inset-0 bg-white z-50 p-4">Session Menu</div> : null;
export const AgentSettingsMenu = (props: any) => props.open ? <div className="fixed inset-0 bg-white z-50 p-4">Settings Menu</div> : null;
export const AgentSessionSettingsPanel = (props: any) => props.open ? <div className="fixed inset-0 bg-white z-50 p-4">Session Settings</div> : null;
export const AgentSessionsView = (props: any) => <div className="p-4">Sessions List</div>;
export const AgentOpenProjectMenu = (props: any) => props.open ? <div className="fixed inset-0 bg-white z-50 p-4">Open Project Menu</div> : null;
export const AttachmentCachePanel = (props: any) => props.open ? <div className="fixed inset-0 bg-white z-50 p-4">Attachment Cache</div> : null;

// Default export if needed, though named exports are used
export default {
    AgentChatShell,
    AgentTopBar,
    AgentComposer,
    AgentConversation,
    AgentProjectMenu,
    AgentSessionMenu,
    AgentSettingsMenu,
    AgentSessionSettingsPanel,
    AgentSessionsView,
    AgentOpenProjectMenu,
    AttachmentCachePanel
};
