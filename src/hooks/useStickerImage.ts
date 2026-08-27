import { useEffect, useState } from 'react';
import { cutoutWhiteBackground } from '@/lib/stickerCutout';

/**
 * 拿到一张可以直接画到画布上的贴纸：白底已抠掉，且已解码成 HTMLImageElement。
 * 抠图是异步的（要读像素），期间返回 null，节点先只显示圆点，抠完再补上贴纸。
 */
export function useStickerImage(url: string | undefined): HTMLImageElement | null {
  const [element, setElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (url === undefined || url.length === 0) {
      setElement(null);
      return;
    }

    let stale = false;
    setElement(null);

    cutoutWhiteBackground(url)
      .then((cutUrl) => {
        if (stale) {
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (!stale) {
            setElement(img);
          }
        };
        img.onerror = () => {
          if (!stale) {
            setElement(null);
          }
        };
        img.src = cutUrl;
      })
      .catch(() => {
        if (!stale) {
          setElement(null);
        }
      });

    return () => {
      stale = true;
    };
  }, [url]);

  return element;
}
