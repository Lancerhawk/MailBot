import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from './api';

interface ExportData {
  kpis: {
    emailsReceived: number;
    draftsGenerated: number;
    averageConfidence: number;
  };
  breakdown: Array<{
    date: string;
    emailsReceived: number;
    draftsGenerated: number;
    draftsApproved: number;
    averageConfidence: number;
    documentsUploaded: number;
  }>;
}

export async function exportToPDF(filename: string, filterParams: Record<string, string | undefined>) {
  try {
    const { data } = await api.get<{ data: ExportData }>('/analytics/export-json', { params: filterParams });
    const exportData = data.data;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(24, 24, 27);
    pdf.text('MailBot Executive Briefing', margin, 28);

    pdf.setDrawColor(249, 115, 22);
    pdf.setLineWidth(1.5);
    pdf.line(margin, 34, 190, 34);

    const dateRange = (filterParams.startDate && filterParams.endDate)
      ? `${filterParams.startDate} to ${filterParams.endDate}`
      : 'All Time';

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(113, 113, 122);
    pdf.text(`Generated: ${new Date().toLocaleString()}  |  Period: ${dateRange}`, margin, 42);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(24, 24, 27);
    pdf.text('Executive Summary', margin, 54);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(63, 63, 70);

    const summaryText = `During this period, MailBot processed a total of ${exportData.kpis.emailsReceived} incoming emails and successfully generated ${exportData.kpis.draftsGenerated} automated draft responses on your behalf. The AI maintained an average confidence rating of ${exportData.kpis.averageConfidence}%, ensuring high-quality context comprehension while significantly reducing your team's manual triage workload.`;

    const splitSummary = pdf.splitTextToSize(summaryText, pageWidth - (margin * 2));
    pdf.text(splitSummary, margin, 62);

    let currentY = 62 + (splitSummary.length * 6) + 10;

    const createSection = (title: string, narrative: string, head: string[][], body: (string | number)[][]) => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(24, 24, 27);
      pdf.text(title, margin, currentY);

      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.setTextColor(113, 113, 122);

      const splitNarrative = pdf.splitTextToSize(narrative, pageWidth - (margin * 2));
      pdf.text(splitNarrative, margin, currentY + 6);

      const tableStartY = currentY + 6 + (splitNarrative.length * 5) + 4;

      autoTable(pdf, {
        startY: tableStartY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { textColor: [63, 63, 70], fontSize: 10 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: margin, right: margin }
      });

      currentY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
    };

    const volumeBody = exportData.breakdown.map((r) => [new Date(r.date).toLocaleDateString(), r.emailsReceived]);
    createSection(
      'Email Volume Trends',
      'The table below illustrates the daily volume of incoming emails processed by MailBot.',
      [['Date', 'Emails Received']],
      volumeBody
    );

    const draftBody = exportData.breakdown.map((r) => [new Date(r.date).toLocaleDateString(), r.draftsGenerated, r.draftsApproved]);
    createSection(
      'Draft Automation Efficiency',
      'This section tracks MailBot\'s drafting efficiency, showing how many AI-generated drafts were successfully created versus how many were ultimately approved.',
      [['Date', 'Drafts Generated', 'Drafts Approved']],
      draftBody
    );

    const confBody = exportData.breakdown.map((r) => [new Date(r.date).toLocaleDateString(), `${(Number(r.averageConfidence) * 100).toFixed(1)}%`]);
    createSection(
      'AI Confidence Matrix',
      'This tracks the internal confidence probability of MailBot\'s generation engine over time. A consistently high percentage indicates the AI is highly certain of its context and accuracy.',
      [['Date', 'Average AI Confidence']],
      confBody
    );

    const kbBody = exportData.breakdown.map((r) => [new Date(r.date).toLocaleDateString(), r.documentsUploaded]);
    createSection(
      'Knowledge Base Scaling',
      'This shows the daily volume of vector embedding documents uploaded and used by MailBot for semantic retrieval and personalized replies.',
      [['Date', 'Documents Uploaded']],
      kbBody
    );

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
}
