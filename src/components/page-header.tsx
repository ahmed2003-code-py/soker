type الخصائص = {
  العنوان: string;
  الوصف?: string;
  إجراء?: React.ReactNode;
};

export function ترويسة_الصفحة({ العنوان, الوصف, إجراء }: الخصائص) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{العنوان}</h1>
        {الوصف && <p className="mt-1 text-sm text-muted-foreground">{الوصف}</p>}
      </div>
      {إجراء && <div className="flex shrink-0 gap-2">{إجراء}</div>}
    </div>
  );
}
