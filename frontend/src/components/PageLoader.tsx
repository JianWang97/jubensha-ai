import React, { useEffect, useState } from 'react';

interface PageLoaderProps {
  visible: boolean;
}

const PageLoader: React.FC<PageLoaderProps> = ({ visible }) => {
  const [show, setShow] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setComplete(false);
    } else if (show) {
      setComplete(true);
      const t = setTimeout(() => {
        setShow(false);
        setComplete(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 pointer-events-none">
      {complete ? (
        <div
          className="h-full w-full bg-gradient-to-r from-[#4a148c] via-purple-500 to-blue-400"
          style={{ animation: 'pageLoaderComplete 400ms ease-out forwards' }}
        />
      ) : (
        <div
          className="h-full bg-gradient-to-r from-[#4a148c] via-purple-500 to-blue-400"
          style={{ animation: 'pageLoaderSlide 1.5s ease-in-out infinite' }}
        />
      )}
      <style>{`
        @keyframes pageLoaderSlide {
          0%   { width: 0%;   transform: translateX(-10%); }
          60%  { width: 75%;  transform: translateX(0%);   }
          100% { width: 0%;   transform: translateX(110%); }
        }
        @keyframes pageLoaderComplete {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PageLoader;