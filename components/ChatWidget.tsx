import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { ChatMessage } from '../types';
import ChatPanel from './ChatPanel';
import { useChatConversations } from '../hooks/useChatConversations';

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, fileData?: { text: string, mimeType: string, isBase64: boolean }) => void;
  isLoading: boolean;
  onSetMessages: (messages: ChatMessage[]) => void;
  liveAssistantButton?: React.ReactNode;
  quickAddButton?: React.ReactNode;
  isLiveActive?: boolean;
  liveStatusText?: string;
  pendingConfirmation?: { summary: string } | null;
  onConfirmActions?: () => void;
  onCancelActions?: () => void;
}

/**
 * Floating chat launcher (bottom-right). Thin wrapper around the presentational
 * ChatPanel; conversation history is owned by useChatConversations.
 */
const ChatWidget: React.FC<ChatWidgetProps> = ({ messages, onSendMessage, isLoading, onSetMessages, liveAssistantButton, quickAddButton, pendingConfirmation, onConfirmActions, onCancelActions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const chatConv = useChatConversations({ messages, onSetMessages });

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat window — kept mounted (hidden when closed) to preserve panel state */}
      <div className={`mb-4 pointer-events-auto ${(!isOpen && !isFullScreen) ? 'hidden' : ''}`}>
        <ChatPanel
          layout="floating"
          messages={messages}
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          pendingConfirmation={pendingConfirmation}
          onConfirmActions={onConfirmActions}
          onCancelActions={onCancelActions}
          liveAssistantButton={liveAssistantButton}
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen(f => !f)}
          onClose={() => setIsOpen(false)}
          {...chatConv}
        />
      </div>

      {/* Toggle button group */}
      {!isFullScreen && (
        <div className="flex flex-col gap-3 items-end pointer-events-auto">
          {quickAddButton && <div className="flex justify-end">{quickAddButton}</div>}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${
              isOpen ? 'bg-slate-700 text-white rotate-90' : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
