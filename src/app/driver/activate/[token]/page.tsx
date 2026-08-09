import { DriverInviteActivation } from "@/features/drivers/components/driver-invite-activation";

type Props = { params: Promise<{ token: string }> };

export default async function DriverInviteActivationPage({ params }: Props) {
  const { token } = await params;
  return <DriverInviteActivation token={token} />;
}
