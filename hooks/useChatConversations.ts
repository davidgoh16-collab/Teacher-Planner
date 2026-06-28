import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { ChatMessage, AIConversation } from '../types';
import { fetchAIConversations, saveAIConversation, deleteAIConversation } from '../services/chatService';

interface UseChatConversationsArgs {
  messages: ChatMessage[];
  onSetMessages: (messages: ChatMessage[]) => void;
  user: User | null;
}

export interface ChatConversationsApi {
  conversations: AIConversation[];
  currentConversationId: string | null;
  editingConvId: string | null;
  editingTitle: string;
  setEditingConvId: (id: string | null) => void;
  setEditingTitle: (title: string) => void;
  ensureConversation: () => void;
  handleNewConversation: () => void;
  handleLoadConversation: (conv: AIConversation) => void;
  handleDeleteConversation: (e: React.MouseEvent, id: string) => void;
  handleRenameSave: (e: React.FormEvent, conv: AIConversation) => void;
}

/**
 * Owns AI conversation history (load/save/delete/rename) for the chat experience.
 *
 * IMPORTANT: this hook must be instantiated EXACTLY ONCE in the app (in App.tsx) and the
 * returned API shared with every chat surface (embedded Home chat + floating launcher).
 * Mounting it more than once would double-load on mount and race Firestore writes on save.
 *
 * Extracted verbatim from the original ChatWidget so behaviour is unchanged.
 */
export function useChatConversations({ messages, onSetMessages, user }: UseChatConversationsArgs): ChatConversationsApi {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleNewConversation = () => {
    setCurrentConversationId(`conv_${Date.now()}`);
    onSetMessages([]);
  };

  // Load the conversation list (for the history menu) but ALWAYS open a fresh
  // conversation each time the app starts. Previous chats stay available in history.
  // We depend on `user` so this re-runs once auth resolves — avoids the "No authenticated
  // user" error that fires when Firebase hasn't resolved the session yet on mount.
  useEffect(() => {
    if (!user) return;
    const loadConvs = async () => {
      try {
        const convs = await fetchAIConversations();
        setConversations(convs);
      } catch (e) {
        console.error('Error fetching AI conversations', e);
      } finally {
        handleNewConversation();
      }
    };
    loadConvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Save the active conversation only when a message is actually added (length changed),
  // so reloading a conversation from history does not re-save it.
  const previousMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    const saveCurrent = async () => {
      if (messages.length > 0 && currentConversationId && messages.length !== previousMessagesLengthRef.current) {
        const currentConv = conversations.find(c => c.id === currentConversationId);
        const title = currentConv?.title || (messages.length > 0 ? messages[0].text.substring(0, 30) + '...' : 'New Conversation');

        const updatedConv: AIConversation = {
          id: currentConversationId,
          title,
          messages,
          updatedAt: Date.now(),
        };

        try {
          await saveAIConversation(updatedConv);
          setConversations(prev => {
            const exists = prev.find(c => c.id === currentConversationId);
            if (exists) return prev.map(c => c.id === currentConversationId ? updatedConv : c);
            return [updatedConv, ...prev];
          });
        } catch (e) {
          console.error(e);
        }
      }
      previousMessagesLengthRef.current = messages.length;
    };

    saveCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentConversationId]);

  // Make sure a conversation id exists before the first message is sent (so it persists).
  const ensureConversation = () => {
    if (!currentConversationId) {
      setCurrentConversationId(`conv_${Date.now()}`);
    }
  };

  const handleLoadConversation = (conv: AIConversation) => {
    setCurrentConversationId(conv.id);
    onSetMessages(conv.messages);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteAIConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        handleNewConversation();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameSave = async (e: React.FormEvent, conv: AIConversation) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }

    const updated = { ...conv, title: editingTitle.trim() };
    try {
      await saveAIConversation(updated);
      setConversations(prev => prev.map(c => c.id === conv.id ? updated : c));
      setEditingConvId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return {
    conversations,
    currentConversationId,
    editingConvId,
    editingTitle,
    setEditingConvId,
    setEditingTitle,
    ensureConversation,
    handleNewConversation,
    handleLoadConversation,
    handleDeleteConversation,
    handleRenameSave,
  };
}
