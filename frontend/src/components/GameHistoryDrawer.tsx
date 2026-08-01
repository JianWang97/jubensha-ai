import React, { useCallback, useEffect, useState } from 'react';
import { Gamepad2, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import GameHistoryDetailContent, { GameHistoryDetailData } from '@/components/GameHistoryDetailContent';
import { fetchGameDetail } from '@/services/gameHistoryService';
import { toast } from 'sonner';

interface GameHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  gameStatus?: string;
  scriptTitle?: string;
}

const GameHistoryDrawer: React.FC<GameHistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessionId,
  gameStatus,
  scriptTitle
}) => {
  const [detail, setDetail] = useState<GameHistoryDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载游戏详情
  const loadGameDetail = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const response = await fetchGameDetail(sessionId);
      setDetail(response.data);
    } catch (error) {
      console.error('Failed to load game detail:', error);
      toast.error('加载游戏详情失败');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadGameDetail();
    }
  }, [isOpen, sessionId, loadGameDetail]);

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh] bg-panel border-line">
        <DrawerHeader className="border-b border-line pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-6 w-6 text-brass" />
              <DrawerTitle className="font-dossier text-xl font-bold text-paper">
                游戏记录详情
              </DrawerTitle>
            </div>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-faint hover:text-paper hover:bg-raised/60"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brass"></div>
            </div>
          ) : detail ? (
            <GameHistoryDetailContent
              detail={detail}
              scriptTitle={scriptTitle}
              fallbackStatus={gameStatus}
              onAction={onClose}
            />
          ) : (
            <div className="text-center py-12 text-mist">
              无法加载游戏详情
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default GameHistoryDrawer;
