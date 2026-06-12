/* =========================================================================
   writer/state.js — Shared mutable application state
   ========================================================================= */

export const state = {
    currentEnvId: null,
    currentDocId: null,
    environments: [],
    documents: [],
    materials: [],
    chatLoading: false,
    chatMessagesPollInterval: null,
    lastMessagesJson: null,
};

