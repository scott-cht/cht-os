'use client';

import { useCallback } from 'react';
import { Shell } from '@/components/shell';
import { StyleGuidePreviewModal } from '@/components/klaviyo/StyleGuidePreviewModal';
import { EditSectionsModal } from '@/components/klaviyo/EditSectionsModal';
import { ImportFromKlaviyoModal } from '@/components/klaviyo/ImportFromKlaviyoModal';
import { CreateEmailCard } from '@/components/klaviyo/CreateEmailCard';
import { EmailPreviewCard } from '@/components/klaviyo/EmailPreviewCard';
import { StyleGuidesCard } from '@/components/klaviyo/StyleGuidesCard';
import { StudioIntroBlocks } from '@/components/klaviyo/StudioIntroBlocks';
import { useEmailPreviewEditor } from '@/hooks/useEmailPreviewEditor';
import { useKlaviyoStudioData } from '@/hooks/useKlaviyoStudioData';
import { useKlaviyoInventoryPicker } from '@/hooks/useKlaviyoInventoryPicker';
import { useKlaviyoComposer } from '@/hooks/useKlaviyoComposer';

const MAX_PICKER_SELECT = 12;
const INTENT_PRESETS = [
  'New arrivals',
  'Trade-in highlights',
  'Ex-demo clearance',
  'Product spotlight',
  'Weekly picks',
];

export default function KlaviyoPage() {
  const {
    filterListingTypes,
    filterLimit,
    setFilterLimit,
    selectedInventoryIds,
    pickerItems,
    pickerTotal,
    pickerOffset,
    pickerLoading,
    pickerSearch,
    setPickerSearch,
    pickerListingType,
    setPickerListingType,
    fetchInventoryForPicker,
    quickFillFromFilter,
    togglePickerProduct,
    clearPickerSelection,
    toggleFilterListingType,
  } = useKlaviyoInventoryPicker({ maxPickerSelect: MAX_PICKER_SELECT });
  const {
    preview,
    setPreview,
    editableKeyText,
    setEditableKeyText,
    previewTab,
    setPreviewTab,
    safePreviewHtml,
    handlePreviewSubjectChange,
    handlePreviewPreheaderChange,
    handlePreviewTabChange,
    handleHeadlineChange,
    handleBodyChange,
    handleCtaChange,
    handlePreviewHtmlChange,
  } = useEmailPreviewEditor();
  const {
    selectedGuideIds,
    setSelectedGuideIds,
    intent,
    setIntent,
    generating,
    pushing,
    createCampaign,
    setCreateCampaign,
    handleGenerate,
    handleCopy,
    handlePush,
    handleSelectedGuideChange,
  } = useKlaviyoComposer({
    selectedInventoryIds,
    filterListingTypes,
    filterLimit,
    setPreview,
    setEditableKeyText,
    setPreviewTab,
  });
  const {
    klaviyoReady,
    styleGuides,
    loadingGuides,
    importModalOpen,
    setImportModalOpen,
    templates,
    campaigns,
    selectedTemplateIds,
    selectedCampaignMessages,
    campaignMessagesCache,
    loadingMessages,
    exporting,
    previewGuide,
    setPreviewGuide,
    editGuide,
    setEditGuide,
    editLayoutNotes,
    setEditLayoutNotes,
    editSectionTags,
    savingNotes,
    openImportModal,
    selectAllTemplates,
    clearTemplates,
    selectAllMessages,
    clearMessages,
    selectCampaignMessages,
    deselectCampaignMessages,
    openPreview,
    openEditSections,
    saveLayoutNotes,
    addSectionTag,
    updateSectionTag,
    removeSectionTag,
    toggleTemplate,
    toggleCampaignMessage,
    handleExportSelected,
    deleteStyleGuide,
    safeGuideHtml,
  } = useKlaviyoStudioData();

  const handleDeleteStyleGuide = useCallback(async (id: string) => {
    const deleted = await deleteStyleGuide(id);
    if (deleted) {
      setSelectedGuideIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [deleteStyleGuide, setSelectedGuideIds]);

  const handleToggleFilterListingType = useCallback((listingType: string) => {
    toggleFilterListingType(listingType);
  }, [toggleFilterListingType]);

  return (
    <Shell title="Email Studio" subtitle="Klaviyo Marketing Engine">
      <div className="max-w-4xl space-y-8">
        <StudioIntroBlocks klaviyoReady={klaviyoReady} />

        <StyleGuidesCard
          loadingGuides={loadingGuides}
          styleGuides={styleGuides}
          klaviyoReady={klaviyoReady}
          onOpenPreview={openPreview}
          onOpenEditSections={openEditSections}
          onDeleteStyleGuide={handleDeleteStyleGuide}
          onOpenImportModal={openImportModal}
        />

        <CreateEmailCard
          maxPickerSelect={MAX_PICKER_SELECT}
          intentPresets={INTENT_PRESETS}
          pickerSearch={pickerSearch}
          pickerListingType={pickerListingType}
          pickerLoading={pickerLoading}
          pickerItems={pickerItems}
          pickerTotal={pickerTotal}
          pickerOffset={pickerOffset}
          selectedInventoryIds={selectedInventoryIds}
          styleGuides={styleGuides}
          selectedGuideIds={selectedGuideIds}
          filterListingTypes={filterListingTypes}
          filterLimit={filterLimit}
          intent={intent}
          generating={generating}
          onPickerSearchChange={setPickerSearch}
          onPickerSearchEnter={() => fetchInventoryForPicker({ search: pickerSearch })}
          onPickerListingTypeChange={setPickerListingType}
          onLoadProducts={() => fetchInventoryForPicker()}
          onQuickFill={quickFillFromFilter}
          onClearPickerSelection={clearPickerSelection}
          onTogglePickerProduct={togglePickerProduct}
          onPrevPickerPage={() => fetchInventoryForPicker({ offset: Math.max(0, pickerOffset - 20) })}
          onNextPickerPage={() => fetchInventoryForPicker({ offset: pickerOffset + 20 })}
          onSelectedGuideChange={handleSelectedGuideChange}
          onToggleFilterListingType={handleToggleFilterListingType}
          onFilterLimitChange={setFilterLimit}
          onIntentChange={setIntent}
          onGenerate={handleGenerate}
        />

        <EmailPreviewCard
          preview={preview}
          safePreviewHtml={safePreviewHtml}
          previewTab={previewTab}
          editableKeyText={editableKeyText}
          pushing={pushing}
          createCampaign={createCampaign}
          onPreviewTabChange={handlePreviewTabChange}
          onSubjectChange={handlePreviewSubjectChange}
          onPreheaderChange={handlePreviewPreheaderChange}
          onHeadlineChange={handleHeadlineChange}
          onBodyChange={handleBodyChange}
          onCtaChange={handleCtaChange}
          onHtmlChange={handlePreviewHtmlChange}
          onCopy={() => handleCopy(preview)}
          onPush={() => handlePush(preview)}
          onCreateCampaignChange={setCreateCampaign}
        />
      </div>

      <StyleGuidePreviewModal
        guide={previewGuide}
        safeHtml={safeGuideHtml}
        onClose={() => setPreviewGuide(null)}
      />

      <EditSectionsModal
        guide={editGuide}
        layoutNotes={editLayoutNotes}
        sectionTags={editSectionTags}
        saving={savingNotes}
        onLayoutNotesChange={setEditLayoutNotes}
        onAddSectionTag={addSectionTag}
        onUpdateSectionTag={updateSectionTag}
        onRemoveSectionTag={removeSectionTag}
        onClose={() => setEditGuide(null)}
        onSave={saveLayoutNotes}
      />

      <ImportFromKlaviyoModal
        open={importModalOpen}
        templates={templates}
        campaigns={campaigns}
        campaignMessagesCache={campaignMessagesCache}
        selectedTemplateIds={selectedTemplateIds}
        selectedCampaignMessages={selectedCampaignMessages}
        loadingMessages={loadingMessages}
        exporting={exporting}
        onClose={() => setImportModalOpen(false)}
        onToggleTemplate={toggleTemplate}
        onToggleCampaignMessage={toggleCampaignMessage}
        onSelectAllTemplates={selectAllTemplates}
        onClearTemplates={clearTemplates}
        onSelectAllMessages={selectAllMessages}
        onClearMessages={clearMessages}
        onSelectCampaignMessages={selectCampaignMessages}
        onDeselectCampaignMessages={deselectCampaignMessages}
        onExportSelected={handleExportSelected}
      />
    </Shell>
  );
}
