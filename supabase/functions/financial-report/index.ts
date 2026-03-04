import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateXLSX(rows: Record<string, any>[], sheetName: string): Uint8Array {
  // Simple XLSX generator using XML-based SpreadsheetML format
  const escapeXml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  
  if (rows.length === 0) {
    rows = [{ "Info": "Nenhum dado encontrado" }];
  }

  const headers = Object.keys(rows[0]);
  
  let sheetData = '<sheetData>';
  // Header row
  sheetData += '<row r="1">';
  headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + (i % 26));
    const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
    sheetData += `<c r="${prefix}${col}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetData += '</row>';

  // Data rows
  rows.forEach((row, ri) => {
    sheetData += `<row r="${ri + 2}">`;
    headers.forEach((h, i) => {
      const col = String.fromCharCode(65 + (i % 26));
      const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
      const val = row[h];
      if (val === null || val === undefined || val === '') {
        // skip empty
      } else if (typeof val === 'number') {
        sheetData += `<c r="${prefix}${col}${ri + 2}"><v>${val}</v></c>`;
      } else {
        sheetData += `<c r="${prefix}${col}${ri + 2}" t="inlineStr"><is><t>${escapeXml(String(val))}</t></is></c>`;
      }
    });
    sheetData += '</row>';
  });
  sheetData += '</sheetData>';

  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${sheetData}
</worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  // Build ZIP manually (minimal ZIP format)
  const encoder = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(wbRels) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet1) },
  ];

  return buildZip(files);
}

function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = [];
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    // Local file header
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // compression (store)
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0, true); // mod date
    view.setUint32(14, crc32(file.data), true); // crc
    view.setUint32(18, file.data.length, true); // compressed size
    view.setUint32(22, file.data.length, true); // uncompressed size
    view.setUint16(26, nameBytes.length, true); // name length
    view.setUint16(28, 0, true); // extra length
    header.set(nameBytes, 30);

    entries.push({ name: nameBytes, data: file.data, offset });
    parts.push(header, file.data);
    offset += header.length + file.data.length;
  }

  // Central directory
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

    const statusLabel = (s: string) => {
      if (s === "pending") return "Pendente";
      if (s === "production") return "Em Produção";
      if (s === "delivered") return "Entregue";
      return s;
    };

    const rows: Record<string, any>[] = items.map((item: any) => {
      const order = orderMap.get(item.order_id) as any;
      const profitUnit = (item.unit_price || 0) - (item.supplier_price || 0);
      const profitTotal = (item.total || 0) - (item.supplier_total || 0);
      const isPending = order?.status === "pending";

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
        "Status Lucro": isPending ? "Pendente Repasse" : "Repassado",
      };
    });

    // Summary
    const totalRevenue = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const totalSupplierCost = items.reduce((s: number, i: any) => s + (i.supplier_total || 0), 0);
    const totalProfit = totalRevenue - totalSupplierCost;
    const pendingOrders = (orders || []).filter((o: any) => o.status === "pending");
    const settledOrders = (orders || []).filter((o: any) => o.status !== "pending");
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
