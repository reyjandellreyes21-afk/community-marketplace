export default function HomeAuthPanel({
  authMode,
  authInput,
  setAuthInput,
  authError,
  onSubmit,
  onClose,
  setAuthMode,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {authMode === "login" ? "Login to continue" : "Create account"}
        </h3>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Close
        </button>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        {authMode === "register" && (
          <input
            value={authInput.name}
            onChange={(event) => setAuthInput((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Full name"
          />
        )}
        <input
          value={authInput.email}
          onChange={(event) => setAuthInput((prev) => ({ ...prev, email: event.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Email"
          type="email"
        />
        <input
          value={authInput.password}
          onChange={(event) => setAuthInput((prev) => ({ ...prev, password: event.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Password"
          type="password"
        />
        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            {authMode === "login" ? "Login" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}
            className="text-sm text-teal-700 hover:text-teal-600"
          >
            {authMode === "login" ? "Need an account?" : "Already have an account?"}
          </button>
        </div>
        {authError && <p className="md:col-span-2 text-sm text-rose-600">{authError}</p>}
        <p className="md:col-span-2 text-xs text-slate-500">Demo: seller@cpr.local / 123456</p>
      </form>
    </section>
  );
}
