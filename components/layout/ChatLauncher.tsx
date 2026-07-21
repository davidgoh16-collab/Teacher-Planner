import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatPanel, { ChatBag } from '../ChatPanel';

interface ChatLauncherProps {
  chat: ChatBag;
  quickAddButton?: React.ReactNode;
}

/**
 * Floating chat launcher (bottom-right) shown when you're away from the Home page.
 * It renders the shared ChatPanel in a popover so the conversation continues across
 * navigation — conversation state lives in App via useChatConversations.
 */
const ChatLauncher: React.FC<ChatLauncherProps> = ({ chat, quickAddButton }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat window — kept mounted (hidden when closed) to preserve panel state */}
      <div className={`mb-4 pointer-events-auto ${(!isOpen && !isFullScreen) ? 'hidden' : ''}`}>
        <ChatPanel
          {...chat}
          layout="floating"
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen(f => !f)}
          onClose={() => setIsOpen(false)}
        />
      </div>

      {/* Toggle button group */}
      {!isFullScreen && (
        <div className="flex flex-col gap-3 items-end pointer-events-auto">
          {quickAddButton && <div className="flex justify-end">{quickAddButton}</div>}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-14 h-14 rounded-full shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${
              isOpen ? 'bg-slate-700 text-white rotate-90' : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
            aria-label={isOpen ? 'Close chat' : 'Open chat'}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatLauncher;
