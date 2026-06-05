"use client";

import { QRCodeSVG } from "qrcode.react";

const CARRIER_LOGO = "/images/Logo_Carrier.jpg";

type StationQRCodeProps = {
  stationRef: string;
  size?: number;
  id?: string;
  className?: string;
  fgColor?: string;
};

export function buildStationUrl(stationRef: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return `${origin}/station/${encodeURIComponent(stationRef)}`;
}

export default function StationQRCode({ stationRef, size = 170, id, className = "", fgColor = "#152C73" }: StationQRCodeProps) {
  const logoSize = Math.round(size * 0.22);

  return (
    <div className={className}>
      <QRCodeSVG
        id={id}
        value={buildStationUrl(stationRef)}
        size={size}
        bgColor="#ffffff"
        fgColor={fgColor}
        level="H"
        includeMargin
        imageSettings={{
          src: CARRIER_LOGO,
          height: logoSize,
          width: logoSize,
          excavate: true,
        }}
      />
    </div>
  );
}
