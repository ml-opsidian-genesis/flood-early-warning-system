import { Skeleton } from "antd";

type CardSkeletonProps = {
  label: string;
};

export default function CardSkeleton({ label }: CardSkeletonProps) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <Skeleton active paragraph={false} className="mt-1" />
    </div>
  );
}
