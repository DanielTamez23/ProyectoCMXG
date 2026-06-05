import Image from "next/image";

type CarrierLogoProps = {
  className?: string;
  height?: number;
};

export default function CarrierLogo({ className = "", height = 40 }: CarrierLogoProps) {
  return (
    <Image
      src="/images/Logo_Carrier.jpg"
      alt="Carrier"
      width={Math.round(height * 3.2)}
      height={height}
      className={`object-contain ${className}`}
      priority
    />
  );
}
