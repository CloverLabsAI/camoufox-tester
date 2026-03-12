"use client";
import { Badge } from "@/components/ui/badge";

interface CheckRowProps {
  name: string;
  passed: boolean;
  detail: string;
}

export function CheckRow({ name, passed, detail }: CheckRowProps) {
  return (
    <div className="flex items-start justify-between py-1.5 px-3 text-sm border-b border-[rgba(139,127,166,0.1)] last:border-0">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[#e0daf0]">{name}</span>
        <p className="text-xs text-[#8b7fa6] truncate mt-0.5">{detail}</p>
      </div>
      <Badge
        variant={passed ? "default" : "destructive"}
        className={`ml-2 shrink-0 text-xs ${passed ? "bg-emerald-600/80 hover:bg-emerald-600" : ""}`}
      >
        {passed ? "PASS" : "FAIL"}
      </Badge>
    </div>
  );
}
