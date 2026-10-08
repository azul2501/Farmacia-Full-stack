"use client";

import { useCallback, useEffect, useState } from "react";
import { getCompanies } from "@/features/companies/services/companies-service";
import type { LoadableState } from "@/features/shared/types/data";
import type { Pharmacy } from "@/types/domain";

export function useCompanies() {
  const [state, setState] = useState<LoadableState<Pharmacy[]>>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const companies = await getCompanies();
      setState({ status: "success", data: companies });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "No se pudieron cargar las empresas.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
