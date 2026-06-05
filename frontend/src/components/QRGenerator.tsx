"use client";

import { Download } from 'lucide-react';
import StationQRCode, { buildStationUrl } from '@/components/StationQRCode';

export default function QRGenerator({ stationRef, stationName }: { stationRef: string, stationName: string }) {
  const url = buildStationUrl(stationRef);
  const qrElementId = `qr-code-${stationRef.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const downloadQR = () => {
    const svg = document.getElementById(qrElementId);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const pngFile = canvas.toDataURL("image/png");
      
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${stationName.replace(/\s+/g, '_')}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-3 rounded-xl shadow-inner mb-4 border border-slate-200">
        <StationQRCode
          id={qrElementId}
          stationRef={stationRef}
          size={140}
        />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-700 hover:underline break-all text-xs mb-1"
        style={{ wordBreak: 'break-all', maxWidth: 180 }}
      >
        {url}
      </a>
      <button
        onClick={() => window.location.href = url}
        className="text-xs text-blue-800 underline hover:text-blue-600 mb-3"
        style={{ marginTop: 2 }}
      >
        Abrir aquí mismo
      </button>
      <button 
        onClick={downloadQR}
        className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/30 active:scale-95"
      >
        <Download className="w-4 h-4" />
        Download QR Code
      </button>
    </div>
  );
}
