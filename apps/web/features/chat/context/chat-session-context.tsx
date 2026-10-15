"use client";

import * as React from "react";

import { useChatRunState } from "@/features/chat/hooks/use-chat-run-state";
import type { ConversationRunStore } from "@/features/chat/model/conversation-run-store";

type ChatSessionContextValue = {
  newConversationRevision: number;
  newConversationProjectID: string;
  newConversationRoleID: string;
  newConversationAgentGroupID: string;
  completeConversationRun: (runID: string, conversationPublicID: string) => void;
  detachConversationRun: (runID: string) => void;
  finishConversationRun: (runID: string) => void;
  registerConversationRun: (runID: string, conversationPublicID: string) => void;
  requestNewConversation: (options?: { projectID?: string; roleID?: string; agentGroupID?: string }) => void;
};

const ChatSessionContext = React.createContext<ChatSessionContextValue | null>(null);
const ConversationRunStoreContext = React.createContext<ConversationRunStore | null>(null);

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState({ revision: 0, projectID: "", roleID: "", agentGroupID: "" });
  const {
    completeConversationRun,
    detachConversationRun,
    finishConversationRun,
    registerConversationRun,
    store,
  } = useChatRunState();
  const requestNewConversation = React.useCallback((options?: { projectID?: string; roleID?: string; agentGroupID?: string }) => {
    setState((prev) => ({
      revision: prev.revision + 1,
      projectID: options?.projectID?.trim() ?? "",
      roleID: options?.roleID?.trim() ?? "",
      agentGroupID: options?.agentGroupID?.trim() ?? "",
    }));
  }, []);
  const value = React.useMemo(
    () => ({
      newConversationRevision: state.revision,
      newConversationProjectID: state.projectID,
      newConversationRoleID: state.roleID,
      newConversationAgentGroupID: state.agentGroupID,
      completeConversationRun,
      detachConversationRun,
      finishConversationRun,
      registerConversationRun,
      requestNewConversation,
    }),
    [
      completeConversationRun,
      detachConversationRun,
      finishConversationRun,
      registerConversationRun,
      requestNewConversation,
      state.projectID,
      state.roleID,
      state.agentGroupID,
      state.revision,
    ],
  );

  return (
    <ConversationRunStoreContext.Provider value={store}>
      <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>
    </ConversationRunStoreContext.Provider>
  );
}

export function useChatSession() {
  const context = React.useContext(ChatSessionContext);
  if (!context) {
    throw new Error("useChatSession must be used within ChatSessionProvider");
  }
  return context;
}

export function useConversationRunning(conversationPublicID: string): boolean {
  const store = React.useContext(ConversationRunStoreContext);
  if (!store) {
    throw new Error("useConversationRunning must be used within ChatSessionProvider");
  }
  const conversationID = conversationPublicID.trim();
  const subscribe = React.useCallback(
    (listener: () => void) => store.subscribe(conversationID, listener),
    [conversationID, store],
  );
  const getSnapshot = React.useCallback(
    () => store.isConversationRunning(conversationID),
    [conversationID, store],
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useConversationStatus(conversationPublicID: string) {
  const store = React.useContext(ConversationRunStoreContext);
  if (!store) {
    throw new Error("useConversationStatus must be used within ChatSessionProvider");
  }
  const conversationID = conversationPublicID.trim();
  const subscribe = React.useCallback(
    (listener: () => void) => store.subscribe(conversationID, listener),
    [conversationID, store],
  );
  const getSnapshot = React.useCallback(
    () => store.getConversationStatus(conversationID),
    [conversationID, store],
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, () => "idle" as const);
}
