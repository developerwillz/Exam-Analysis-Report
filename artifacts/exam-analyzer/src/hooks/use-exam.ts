import { useQueryClient } from "@tanstack/react-query";
import { 
  useParseExamHtml, 
  useExportCsv, 
  useGetQuestionTypes, 
  useSaveQuestionTypes,
  getGetQuestionTypesQueryKey
} from "@workspace/api-client-react";
import type { ExportCsvRequest } from "@workspace/api-client-react";

export function useExamParser() {
  return useParseExamHtml();
}

export function useExamTypes() {
  return useGetQuestionTypes();
}

export function useSaveExamTypes() {
  const queryClient = useQueryClient();
  return useSaveQuestionTypes({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuestionTypesQueryKey() });
      }
    }
  });
}

export function useCsvExport() {
  const exportMutation = useExportCsv();

  const downloadCsv = async (data: ExportCsvRequest, filename: string = "exam_results.csv") => {
    try {
      const csvContent = await exportMutation.mutateAsync({ data });
      
      // Create a blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error("Failed to export CSV:", error);
      throw error;
    }
  };

  return {
    ...exportMutation,
    downloadCsv
  };
}
