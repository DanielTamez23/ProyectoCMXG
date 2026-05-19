"use client";

import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

export default function QRGenerator({ stationId, stationName }: { stationId: number, stationName: string }) {
  // Use window.location.origin to point to the current frontend domain/port, 
  // falling back to localhost:3000 during SSR
  const url = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/station/${stationId}`;

  const downloadQR = () => {
    const svg = document.getElementById(`qr-code-${stationId}`);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white"; // Background color
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
        <QRCodeSVG 
          id={`qr-code-${stationId}`}
          value={url} 
          size={140}
          bgColor={"#ffffff"}
          fgColor={"#0f172a"}
          level={"H"}
          includeMargin={false}
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
