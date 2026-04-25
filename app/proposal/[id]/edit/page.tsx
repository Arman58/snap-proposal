"use client";

import { useParams } from "next/navigation";
import { ProposalBuilder } from "@/components/proposal/proposal-builder";

export default function EditProposalPage() {
  const { id } = useParams<{ id: string }>();
  return <ProposalBuilder initialId={id} />;
}
