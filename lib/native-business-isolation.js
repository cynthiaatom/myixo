// Native chat separation is not a substitute for native memory or tool isolation.
// Explicitly fail closed until a provider-backed project boundary is verified.
export function nativeBusinessIsolationGate(input){
 const x=input||{};
 const checks={
  owner_authenticated:x.owner_authenticated===true,
  workspace_membership_verified:x.workspace_membership_verified===true,
  workspace_chat_binding_verified:x.workspace_chat_binding_verified===true,
  native_project_id_verified:x.native_project_id_verified===true,
  native_memory_isolation_verified:x.native_memory_isolation_verified===true,
  native_tool_isolation_verified:x.native_tool_isolation_verified===true,
  run_ownership_verified:x.run_ownership_verified===true,
  consent_to_business_transfer:x.consent_to_business_transfer===true
 };
 return {allowed:Object.values(checks).every(Boolean),checks,missing:Object.keys(checks).filter(k=>!checks[k])};
}
