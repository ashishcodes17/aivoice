import Link from "next/link";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { duration, formatDateTime, rupees } from "@/lib/format";
import type { Call } from "@/lib/types";

const statusVariant = {
  initiated: "outline",
  answered: "info",
  ended: "secondary",
  completed: "success",
  failed: "error",
} as const;

export function CallsTable({ calls }: { calls: Call[] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((c) => {
            const Icon = c.direction === "inbound" ? ArrowDownLeftIcon : ArrowUpRightIcon;
            return (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                <TableCell>
                  <Link href={`/dashboard/calls/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className="tabular-nums">
                      {c.direction === "inbound" ? c.from_number : c.to_number}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.agents?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{duration(c.duration_seconds)}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(c.cost_paise)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status]} className="capitalize">
                    {c.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
