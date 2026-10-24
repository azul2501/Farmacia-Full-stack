export type Company = {
  id: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  status: "active" | "inactive";
  /** Estado de la suscripción: prueba, activa o suspendida. */
  subscriptionStatus?: "TRIAL" | "ACTIVE" | "SUSPENDED";
  trialEndsAt?: string | null;
  /** false cuando la prueba venció o la cuenta está suspendida: puede entrar pero no vender. */
  canOperate?: boolean;
};
