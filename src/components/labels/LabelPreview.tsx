'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { InventoryItem } from '@/types';
import type { LabelContent, LabelTemplate } from '@/lib/labels/templates';
import { QR_CODE_SIZES } from '@/lib/labels/templates';

interface LabelPreviewProps {
  item: InventoryItem;
  template: LabelTemplate;
  content: LabelContent;
  baseUrl?: string;
}

export function LabelPreview({ item, template, content, baseUrl = '' }: LabelPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate QR code
  useEffect(() => {
    if (!content.showQrCode) return;

    const url = `${baseUrl}/inventory/${item.id}`;
    
    QRCode.toDataURL(url, {
      width: QR_CODE_SIZES[content.qrCodeSize] * 4, // Higher res for printing
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [item.id, content.showQrCode, content.qrCodeSize, baseUrl]);

  // Calculate discount percentage
  const discount = item.rrp_aud && item.sale_price
    ? Math.round(((item.rrp_aud - item.sale_price) / item.rrp_aud) * 100)
    : 0;

  // Determine layout based on template size
  const isSmallLabel = template.labelHeight < 40;
  const isMediumLabel = template.labelHeight >= 40 && template.labelHeight < 70;
  const isLargeLabel = template.labelHeight >= 70;

  return (
    <div 
      className="bg-white border border-zinc-300 overflow-hidden flex flex-col"
      style={{
        width: `${template.labelWidth}mm`,
        height: `${template.labelHeight}mm`,
        padding: isSmallLabel ? '2mm' : '4mm',
      }}
    >
      {/* Small Label Layout */}
      {isSmallLabel && (
        <div className="flex items-center justify-between h-full">
          {content.showQrCode && qrDataUrl && (
            <img 
              src={qrDataUrl} 
              alt="QR Code"
              style={{ width: `${QR_CODE_SIZES.small}mm`, height: `${QR_CODE_SIZES.small}mm` }}
            />
          )}
          <div className="flex-1 text-center px-1">
            {content.showBrand && content.showModel && (
              <p className="text-[8pt] font-semibold truncate leading-tight">
                {item.brand} {item.model}
              </p>
            )}
            {content.showPrice && (
              <p className="text-[12pt] font-bold leading-tight">
                ${item.sale_price?.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Medium Label Layout */}
      {isMediumLabel && (
        <div className="flex h-full">
          {content.showQrCode && qrDataUrl && (
            <div className="flex-shrink-0 mr-2">
              <img 
                src={qrDataUrl} 
                alt="QR Code"
                style={{ width: `${QR_CODE_SIZES.medium}mm`, height: `${QR_CODE_SIZES.medium}mm` }}
              />
            </div>
          )}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              {content.showBrand && (
                <p className="text-[8pt] text-zinc-500 truncate uppercase tracking-wider">
                  {item.brand}
                </p>
              )}
              {content.showModel && (
                <p className="text-[10pt] font-semibold truncate leading-tight">
                  {item.model}
                </p>
              )}
              {content.showSku && item.sku && (
                <p className="text-[7pt] text-zinc-400 truncate">
                  SKU: {item.sku}
                </p>
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                {content.showRrp && item.rrp_aud && item.rrp_aud !== item.sale_price && (
                  <p className="text-[8pt] text-zinc-400 line-through">
                    RRP ${item.rrp_aud.toLocaleString()}
                  </p>
                )}
                {content.showPrice && (
                  <p className="text-[14pt] font-bold leading-none">
                    ${item.sale_price?.toLocaleString()}
                  </p>
                )}
              </div>
              {content.showDiscount && discount > 0 && (
                <span className="text-[9pt] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                  -{discount}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Large Label Layout */}
      {isLargeLabel && (
        <div className="flex flex-col h-full">
          <div className="flex items-start">
            {content.showQrCode && qrDataUrl && (
              <div className="flex-shrink-0 mr-3">
                <img 
                  src={qrDataUrl} 
                  alt="QR Code"
                  style={{ width: `${QR_CODE_SIZES.large}mm`, height: `${QR_CODE_SIZES.large}mm` }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {content.showBrand && (
                <p className="text-[10pt] text-zinc-500 uppercase tracking-wider">
                  {item.brand}
                </p>
              )}
              {content.showModel && (
                <p className="text-[14pt] font-bold leading-tight">
                  {item.model}
                </p>
              )}
              {content.showSku && item.sku && (
                <p className="text-[8pt] text-zinc-400 mt-1">
                  SKU: {item.sku}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1" />

          <div className="border-t border-dashed border-zinc-300 pt-2 mt-2">
            <div className="flex items-end justify-between">
              <div>
                {content.showRrp && item.rrp_aud && item.rrp_aud !== item.sale_price && (
                  <p className="text-[10pt] text-zinc-400 line-through">
                    RRP ${item.rrp_aud.toLocaleString()}
                  </p>
                )}
                {content.showPrice && (
                  <p className="text-[24pt] font-bold leading-none">
                    ${item.sale_price?.toLocaleString()}
                  </p>
                )}
              </div>
              {content.showDiscount && discount > 0 && (
                <span className="text-[12pt] font-bold text-white bg-red-600 px-2 py-1 rounded">
                  SAVE {discount}%
                </span>
              )}
            </div>
          </div>

          {content.customText && (
            <p className="text-[7pt] text-zinc-400 mt-1 text-center">
              {content.customText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
