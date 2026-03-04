import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateXLSXMultiSheet(sheets: { name: string; rows: Record<string, any>[] }[]): Uint8Array {
  const escapeXml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const sheetFiles: { name: string; content: string }[] = [];

  for (let si = 0; si < sheets.length; si++) {
    let rows = sheets[si].rows;
    if (rows.length === 0) rows = [{ "Info": "Nenhum dado encontrado" }];

    const headers = Object.keys(rows[0]);
    let sheetData = '<sheetData>';
    sheetData += '<row r="1">';
    headers.forEach((h, i) => {
      const col = getCol(i);
      sheetData += `<c r="${col}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
    });
    sheetData += '</row>';

    rows.forEach((row, ri) => {
      sheetData += `<row r="${ri + 2}">`;
      headers.forEach((h, i) => {
        const col = getCol(i);
        const val = row[h];
        if (val === null || val === undefined || val === '') { /* skip */ }
        else if (typeof val === 'number') {
          sheetData += `<c r="${col}${ri + 2}"><v>${val}</v></c>`;
        } else {
          sheetData += `<c r="${col}${ri + 2}" t="inlineStr"><is><t>${escapeXml(String(val))}</t></is></c>`;
        }
      });
      sheetData += '</row>';
    });
    sheetData += '</sheetData>';

    sheetFiles.push({
      name: `xl/worksheets/sheet${si + 1}.xml`,
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n${sheetData}\n</worksheet>`,
    });
  }

  const sheetOverrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('\n');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheetOverrides}
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const sheetEntries = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  ).join('\n');

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetEntries}</sheets>
</workbook>`;

  const wbRelsEntries = sheets.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('\n');

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${wbRelsEntries}
</Relationships>`;

  const encoder = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(wbRels) },
    ...sheetFiles.map(sf => ({ name: sf.name, data: encoder.encode(sf.content) })),
  ];

  return buildZip(files);
}

function getCol(i: number): string {
  let col = '';
  let n = i;
  while (n >= 0) {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
}

// Keep single-sheet for backward compat
function generateXLSX(rows: Record<string, any>[], sheetName: string): Uint8Array {
  return generateXLSXMultiSheet([{ name: sheetName, rows }]);
}

function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = [];
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc32(file.data), true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    entries.push({ name: nameBytes, data: file.data, offset });
    parts.push(header, file.data);
    offset += header.length + file.data.length;
  }

  const cdStart = offset;
  for (const entry of entries) {
    const cd = new Uint8Array(46 + entry.name.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, crc32(entry.data), true);
    cdv.setUint32(20, entry.data.length, true);
    cdv.setUint32(24, entry.data.length, true);
    cdv.setUint16(28, entry.name.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, entry.offset, true);
    cd.set(entry.name, 46);
    parts.push(cd);
    offset += cd.length;
  }

  const cdSize = offset - cdStart;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);
  parts.push(eocd);

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    pending: "Pendente", production: "Em Produção", delivered: "Entregue",
    paid: "Pago", awaiting_payment: "Aguardando Pagamento", ready: "Pronto", cancelled: "Cancelado",
  };
  return map[s] || s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("x-cron-call") === "true";

    if (!isCron && authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
      const userClient = createClient(supabaseUrl, anonKey!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const url = new URL(req.url);
    const qMonth = url.searchParams.get("month");
    const qYear = url.searchParams.get("year");
    const exportType = url.searchParams.get("type"); // "all_orders" for full export

    // ── FULL ORDER EXPORT ──
    if (exportType === "all_orders") {
      const { data: allOrders } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: true });

      const orders = allOrders || [];

      // Group by status
      const statusGroups: Record<string, any[]> = {};
      for (const o of orders) {
        const label = statusLabel(o.status);
        if (!statusGroups[label]) statusGroups[label] = [];
        statusGroups[label].push(o);
      }

      const sheets: { name: string; rows: Record<string, any>[] }[] = [];

      for (const [groupName, groupOrders] of Object.entries(statusGroups)) {
        const rows = groupOrders.map((o: any) => ({
          "Nº do Pedido": o.order_number || "",
          "Aluno": o.student_name || "",
          "Turma": o.grade || "",
          "Valor de Venda": Number(o.total_amount || 0),
          "Custo Fornecedor": Number(o.supplier_total_amount || 0),
          "Valor de Repasse": Number(o.repasse_amount ?? o.supplier_total_amount ?? 0),
          "Lucro da Escola": Number(o.school_profit ?? (Number(o.total_amount || 0) - Number(o.supplier_total_amount || 0))),
          "Status": statusLabel(o.status),
          "Repasse Concluído": o.repasse_completed ? "Sim" : "Não",
          "Data Repasse": o.repasse_date ? new Date(o.repasse_date).toLocaleString("pt-BR") : "",
          "Data do Pedido": o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "",
        }));
        sheets.push({ name: groupName.substring(0, 31), rows });
      }

      if (sheets.length === 0) {
        sheets.push({ name: "Pedidos", rows: [{ "Info": "Nenhum pedido encontrado" }] });
      }

      const today = new Date().toISOString().split("T")[0];
      const fileName = `backup_pedidos_${today}.xlsx`;
      const xlsxBuffer = generateXLSXMultiSheet(sheets);

      await supabase.storage.from("reports").upload(fileName, xlsxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

      await supabase.from("backup_history").insert({
        backup_type: "order_export",
        file_path: fileName,
        created_by: "admin",
        file_size: xlsxBuffer.length,
      });

      const wantDownload = url.searchParams.get("download") === "true";
      if (wantDownload) {
        return new Response(xlsxBuffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        });
      }

      return new Response(
        JSON.stringify({ success: true, file: fileName, orders: orders.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MONTHLY FINANCIAL REPORT (existing) ──
    let month: number;
    let year: number;

    if (qMonth && qYear) {
      month = parseInt(qMonth);
      year = parseInt(qYear);
    } else {
      const now = new Date();
      if (isCron) {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        month = prev.getMonth() + 1;
        year = prev.getFullYear();
      } else {
        month = now.getMonth() + 1;
        year = now.getFullYear();
      }
    }

    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01T00:00:00.000Z`;
    const lastDay = new Date(year, month, 0);
    const endDate = `${year}-${monthStr}-${String(lastDay.getDate()).padStart(2, "0")}T23:59:59.999Z`;

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    const orderIds = (orders || []).map((o: any) => o.id);

    let items: any[] = [];
    if (orderIds.length > 0) {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      items = data || [];
    }

    const orderMap = new Map((orders || []).map((o: any) => [o.id, o]));

    const rows: Record<string, any>[] = items.map((item: any) => {
      const order = orderMap.get(item.order_id) as any;
      const profitUnit = (item.unit_price || 0) - (item.supplier_price || 0);
      const profitTotal = (item.total || 0) - (item.supplier_total || 0);

      return {
        "Data do Pedido": order ? new Date(order.created_at).toLocaleDateString("pt-BR") : "",
        "Nº Pedido": order?.order_number || "",
        "Aluno": order?.student_name || "",
        "Série/Turma": order?.grade || "",
        "Responsável": order?.responsible_name || "",
        "Produto": item.product_name,
        "Tamanho": item.size,
        "Quantidade": item.quantity,
        "Preço Unit. Escola": item.unit_price,
        "Total Escola": item.total,
        "Custo Unit. Fornecedor": item.supplier_price,
        "Total Fornecedor": item.supplier_total,
        "Lucro Unitário": profitUnit,
        "Lucro Total": profitTotal,
        "Status Pedido": statusLabel(order?.status || ""),
        "Repasse Concluído": order?.repasse_completed ? "Sim" : "Não",
      };
    });

    const totalRevenue = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const totalSupplierCost = items.reduce((s: number, i: any) => s + (i.supplier_total || 0), 0);
    const totalProfit = totalRevenue - totalSupplierCost;
    const pendingOrders = (orders || []).filter((o: any) => !o.repasse_completed);
    const settledOrders = (orders || []).filter((o: any) => o.repasse_completed);
    const pendingProfit = pendingOrders.reduce((s: number, o: any) => s + ((o.total_amount || 0) - (o.supplier_total_amount || 0)), 0);
    const settledProfit = settledOrders.reduce((s: number, o: any) => s + ((o.total_amount || 0) - (o.supplier_total_amount || 0)), 0);

    rows.push({});
    rows.push({ "Data do Pedido": "═══ RESUMO MENSAL ═══", "Nº Pedido": `${monthStr}/${year}` });
    rows.push({ "Data do Pedido": "Total Pedidos", "Nº Pedido": (orders || []).length });
    rows.push({ "Data do Pedido": "Receita Total (Escola)", "Nº Pedido": `R$ ${totalRevenue.toFixed(2)}` });
    rows.push({ "Data do Pedido": "Custo Total (Fornecedor)", "Nº Pedido": `R$ ${totalSupplierCost.toFixed(2)}` });
    rows.push({ "Data do Pedido": "Lucro Total Gerado", "Nº Pedido": `R$ ${totalProfit.toFixed(2)}` });
    rows.push({ "Data do Pedido": "Lucro Pendente Repasse", "Nº Pedido": `R$ ${pendingProfit.toFixed(2)}` });
    rows.push({ "Data do Pedido": "Lucro Repassado", "Nº Pedido": `R$ ${settledProfit.toFixed(2)}` });

    const sheetName = `Relatorio ${monthStr}-${year}`;
    const xlsxBuffer = generateXLSX(rows, sheetName);
    const filePath = `relatorio-${year}-${monthStr}.xlsx`;

    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(filePath, xlsxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    await supabase.from("backup_history").insert({
      backup_type: "financial_report",
      file_path: filePath,
      created_by: isCron ? "system" : "admin",
      file_size: xlsxBuffer.length,
      month_ref: `${year}-${monthStr}`,
    });

    const wantDownload = url.searchParams.get("download") === "true";
    if (wantDownload) {
      return new Response(xlsxBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filePath}"`,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, file: filePath, orders: (orders || []).length, items: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
