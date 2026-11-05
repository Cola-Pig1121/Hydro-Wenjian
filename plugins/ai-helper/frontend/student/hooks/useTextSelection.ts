import { useState, useCallback } from 'react';

interface UseTextSelectionOptions {
  onClarify: (text: string, sourceId: string) => void;
}

export function useTextSelection({ onClarify }: UseTextSelectionOptions) {
  const [selectedText, setSelectedText] = useState('');
  const [selectedSourceAiMessageId, setSelectedSourceAiMessageId] = useState('');
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingAutoSubmit, setPendingAutoSubmit] = useState(false);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopupPosition(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setPopupPosition(null);
      return;
    }
    let node = selection.anchorNode;
    let isInAiMessage = false;
    let aiMessageId = '';
    while (node) {
      if (node instanceof HTMLElement && node.dataset.aiMessage === 'true') {
        isInAiMessage = true;
        aiMessageId = node.dataset.messageId || '';
        break;
      }
      node = node.parentNode;
    }
    if (isInAiMessage) {
      // Only read the selection's geometry to position the popup. We must NOT
      // re-apply the selection (removeAllRanges()/addRange()) afterwards: the
      // native highlight already survives the React re-render, and forcing a
      // programmatic re-selection makes Chrome drop the painted highlight,
      // so the user loses sight of what they selected while the popup is open.
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setSelectedText(text);
      setSelectedSourceAiMessageId(aiMessageId);
      setPopupPosition({ x: rect.left + rect.width / 2, y: rect.top - 40 });
    } else {
      setPopupPosition(null);
    }
  }, []);

  const handleDontUnderstand = useCallback(() => {
    if (!selectedSourceAiMessageId) {
      setPopupPosition(null);
      return;
    }
    const truncated = selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText;
    onClarify(truncated, selectedSourceAiMessageId);
    setPopupPosition(null);
    setPendingAutoSubmit(true);
  }, [selectedText, selectedSourceAiMessageId, onClarify]);

  return {
    selectedText,
    selectedSourceAiMessageId,
    popupPosition,
    pendingAutoSubmit,
    setPendingAutoSubmit,
    handleTextSelection,
    handleDontUnderstand,
  };
}
