
import { useFileExplorer } from '@/contexts/FileExplorerContext';

export const useChatIntegration = () => {
  const { isChatOpen, setIsChatOpen } = useFileExplorer();

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const openChat = () => {
    setIsChatOpen(true);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  return {
    isChatOpen,
    toggleChat,
    openChat,
    closeChat,
  };
};
