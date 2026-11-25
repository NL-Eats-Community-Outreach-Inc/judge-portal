'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  defineDecorator,
  defineSchema,
  defineTextBlock,
  EditorProvider,
  keyGenerator,
  PortableTextEditable,
  useEditor,
  type PortableTextBlock,
  type TextBlockRenderProps,
} from '@portabletext/editor';
import Image from 'next/image';
import { EventListenerPlugin, NodePlugin } from '@portabletext/editor/plugins';
import { uploadVideo } from '@/lib/mux/upload-video';

type ContentBlock = {
  _key: string;
  _type: string;
  [key: string]: unknown;
};

type LessonResponse = {
  lesson: {
    _id?: string;
    title?: string;
    description?: string | null;
    [key: string]: unknown;
  };
  content?: {
    title?: string;
    contentBlocks?: ContentBlock[];
    [key: string]: unknown;
  } | null;
};

const schemaDefinition = defineSchema({
  decorators: [{ name: 'strong' }, { name: 'em' }, { name: 'underline' }],
  styles: [
    { name: 'normal' },
    { name: 'h1' },
    { name: 'h2' },
    { name: 'h3' },
    { name: 'blockquote' },
  ],
  lists: [{ name: 'bullet' }, { name: 'number' }],
  annotations: [],
  inlineObjects: [],
  blockObjects: [],
});

const textBlockNode = defineTextBlock({
  type: 'block',
  render: (props: TextBlockRenderProps) => {
    const style = props.node.style;

    let children = props.children;

    if (style === 'h1') children = <h1>{children}</h1>;
    else if (style === 'h2') children = <h2>{children}</h2>;
    else if (style === 'h3') children = <h3>{children}</h3>;
    else if (style === 'blockquote') {
      children = <blockquote>{children}</blockquote>;
    }

    return (
      <div
        {...props.attributes}
        style={{ marginBottom: '0.75rem' }}
        data-list-item={props.node.listItem}
        data-level={props.node.level}
      >
        {children}
      </div>
    );
  },
});

const strongDecorator = defineDecorator({
  type: 'strong',
  render: ({ children }) => <strong>{children}</strong>,
});

const emDecorator = defineDecorator({
  type: 'em',
  render: ({ children }) => <em>{children}</em>,
});

const underlineDecorator = defineDecorator({
  type: 'underline',
  render: ({ children }) => <u>{children}</u>,
});

const editorNodes = [textBlockNode, strongDecorator, emDecorator, underlineDecorator];

function createEmptyTextBlock(): ContentBlock {
  return {
    _type: 'textBlock',
    _key: keyGenerator(),
    content: [
      {
        _type: 'block',
        _key: keyGenerator(),
        style: 'normal',
        markDefs: [],
        children: [
          {
            _type: 'span',
            _key: keyGenerator(),
            text: '',
            marks: [],
          },
        ],
      },
    ],
  };
}

function EditorToolbar() {
  const editor = useEditor();

  const buttons = [
    { label: 'B', type: 'decorator', value: 'strong', title: 'Bold' },
    { label: 'I', type: 'decorator', value: 'em', title: 'Italic' },
    { label: 'U', type: 'decorator', value: 'underline', title: 'Underline' },
    { label: 'H1', type: 'style', value: 'h1', title: 'Heading 1' },
    { label: 'H2', type: 'style', value: 'h2', title: 'Heading 2' },
    { label: 'H3', type: 'style', value: 'h3', title: 'Heading 3' },
    { label: 'P', type: 'style', value: 'normal', title: 'Paragraph' },
    { label: 'Quote', type: 'style', value: 'blockquote', title: 'Blockquote' },
    { label: '• List', type: 'list', value: 'bullet', title: 'Bullet list' },
    { label: '1. List', type: 'list', value: 'number', title: 'Numbered list' },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 p-3">
      {buttons.map((button) => (
        <button
          key={`${button.type}-${button.value}`}
          type="button"
          title={button.title}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (button.type === 'decorator') {
              editor.send({
                type: 'decorator.toggle',
                decorator: button.value,
              });
            } else if (button.type === 'style') {
              editor.send({
                type: 'style.toggle',
                style: button.value,
              });
            } else {
              editor.send({
                type: 'list item.toggle',
                listItem: button.value,
              });
            }

            editor.send({ type: 'focus' });
          }}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

function RichTextEditor({
  initialValue,
  onChange,
}: {
  initialValue: PortableTextBlock[];
  onChange: (value: PortableTextBlock[]) => void;
}) {
  return (
    <EditorProvider
      initialConfig={{
        schemaDefinition,
        initialValue,
      }}
    >
      <EventListenerPlugin
        on={(event) => {
          if (event.type === 'mutation' && event.value) {
            onChange(event.value);
          }
        }}
      />

      <NodePlugin nodes={editorNodes} />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <EditorToolbar />

        <PortableTextEditable
          className="min-h-[320px] p-5 outline-none"
          style={{
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>
    </EditorProvider>
  );
}

export default function TeacherLessonEditor({
  courseSlug,
  moduleSlug,
  lessonSlug,
}: {
  courseSlug: string;
  moduleSlug: string;
  lessonSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');

  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [muxAssets, setMuxAssets] = useState<
    Array<{
      id: string;
      title: string | null;
      status: string;
      playbackId: string | null;
      thumbnailUrl: string | null;
    }>
  >([]);
  const [muxLoading, setMuxLoading] = useState(false);
  const [muxError, setMuxError] = useState<string | null>(null);
  const [selectingVideoFor, setSelectingVideoFor] = useState<string | null>(null);
  const [uploadingBlock, setUploadingBlock] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<
    Record<string, { url?: string; filename?: string; mimeType?: string; size?: number }>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/teacher/lessons/${encodeURIComponent(lessonSlug)}?courseSlug=${encodeURIComponent(courseSlug)}&moduleSlug=${encodeURIComponent(moduleSlug)}`,
          {
            cache: 'no-store',
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load lesson.');
        }

        const result = data as LessonResponse;
        const rawBlocks = result.content?.contentBlocks ?? [];

        const hydratedAssets: Record<
          string,
          { url?: string; filename?: string; mimeType?: string; size?: number }
        > = {};
        const blocks = rawBlocks.map((block) => {
          const next = { ...block };
          if (block._type === 'imageBlock' && block.image && typeof block.image === 'object') {
            const image = block.image as { asset?: { _id?: string; url?: string } };
            if (image.asset?._id) {
              hydratedAssets[block._key] = { url: image.asset.url };
              next.image = { ...image, asset: { _type: 'reference', _ref: image.asset._id } };
            }
          }
          if (block._type === 'fileBlock' && block.file && typeof block.file === 'object') {
            const file = block.file as {
              asset?: {
                _id?: string;
                url?: string;
                originalFilename?: string;
                mimeType?: string;
                size?: number;
              };
            };
            if (file.asset?._id) {
              hydratedAssets[block._key] = {
                url: file.asset.url,
                filename: file.asset.originalFilename,
                mimeType: file.asset.mimeType,
                size: file.asset.size,
              };
              next.file = { ...file, asset: { _type: 'reference', _ref: file.asset._id } };
            }
          }
          if (block._type === 'videoBlock' && block.video && typeof block.video === 'object') {
            const video = block.video as { asset?: { _id?: string } };
            if (video.asset?._id) {
              next.video = {
                ...video,
                asset: { _type: 'reference', _ref: video.asset._id, _weak: true },
              };
            }
          }
          return next;
        });

        if (cancelled) return;
        setUploadedAssets(hydratedAssets);

        setTitle(result.content?.title ?? result.lesson.title ?? '');
        setSlug(typeof result.lesson.slug === 'string' ? result.lesson.slug : lessonSlug);
        setSlugManuallyEdited(false);
        setDescription(
          typeof result.lesson.description === 'string' ? result.lesson.description : ''
        );

        setContentBlocks(blocks.length > 0 ? blocks : [createEmptyTextBlock()]);

        setEditorKey((current) => current + 1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLesson();

    return () => {
      cancelled = true;
    };
  }, [courseSlug, moduleSlug, lessonSlug]);

  async function saveLesson() {
    try {
      const missingMedia = contentBlocks.find(
        (block) =>
          (block._type === 'imageBlock' && !block.image) ||
          (block._type === 'fileBlock' && !block.file) ||
          (block._type === 'videoBlock' && !block.video)
      );

      if (missingMedia) {
        setError(
          `The ${missingMedia._type.replace('Block', '').toLowerCase()} block needs an attached asset before this lesson can be saved.`
        );
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(
        `/api/teacher/lessons/${encodeURIComponent(lessonSlug)}?courseSlug=${encodeURIComponent(courseSlug)}&moduleSlug=${encodeURIComponent(moduleSlug)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            slug,
            description,
            contentBlocks,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save lesson.');
      }

      const savedLessonSlug = data.lesson?.slug;
      setSuccess(true);
      if (typeof savedLessonSlug === 'string' && savedLessonSlug !== lessonSlug) {
        router.replace(
          `/classroom/teacher/courses/${encodeURIComponent(courseSlug)}/module/${encodeURIComponent(moduleSlug)}/lessons/${encodeURIComponent(savedLessonSlug)}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading lesson editor...</div>;
  }

  if (error && contentBlocks.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  function updateBlock(blockKey: string, updates: Record<string, unknown>) {
    setContentBlocks((current) =>
      current.map((block) => (block._key === blockKey ? { ...block, ...updates } : block))
    );
    setSuccess(false);
  }

  function addBlock(type: 'textBlock' | 'videoBlock' | 'imageBlock' | 'fileBlock') {
    const key = keyGenerator();
    const block: ContentBlock =
      type === 'textBlock'
        ? createEmptyTextBlock()
        : type === 'videoBlock'
          ? { _type: type, _key: key, title: '', description: '', video: null }
          : type === 'imageBlock'
            ? { _type: type, _key: key, caption: '', alt: '', image: null }
            : { _type: type, _key: key, title: '', description: '', file: null };
    setContentBlocks((current) => [...current, block]);
    setShowAddMenu(false);
    setSuccess(false);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setContentBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSuccess(false);
  }

  function duplicateBlock(index: number) {
    setContentBlocks((current) => {
      const duplicate = JSON.parse(JSON.stringify(current[index])) as ContentBlock;
      duplicate._key = keyGenerator();
      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
    });
    setSuccess(false);
  }

  async function loadMuxAssets() {
    setMuxLoading(true);
    setMuxError(null);
    try {
      const response = await fetch('/api/teacher/mux/assets?limit=50', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load videos.');
      setMuxAssets(data.assets ?? []);
    } catch (err) {
      setMuxError(err instanceof Error ? err.message : 'Could not load videos.');
    } finally {
      setMuxLoading(false);
    }
  }

  function selectMuxAsset(blockKey: string, assetId: string) {
    updateBlock(blockKey, {
      video: {
        _type: 'mux.video',
        asset: { _type: 'reference', _ref: `mux-video-${assetId}`, _weak: true },
      },
    });
    setSelectingVideoFor(null);
  }

  async function uploadImageOrFile(blockKey: string, file: File, kind: 'image' | 'file') {
    setUploadingBlock(blockKey);
    setUploadMessage(null);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/teacher/assets/${kind}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.asset?._id)
        throw new Error(data.error || `Failed to upload ${kind}.`);

      const asset = data.asset as {
        _id: string;
        url?: string;
        originalFilename?: string;
        mimeType?: string;
        size?: number;
      };
      const reference = { _type: 'reference', _ref: asset._id };
      updateBlock(blockKey, {
        [kind]:
          kind === 'image'
            ? { _type: 'image', asset: reference }
            : { _type: 'file', asset: reference },
        ...(kind === 'file' && !contentBlocks.find((block) => block._key === blockKey)?.title
          ? { title: asset.originalFilename || file.name }
          : {}),
      });
      setUploadedAssets((current) => ({
        ...current,
        [blockKey]: {
          url: asset.url,
          filename: asset.originalFilename || file.name,
          mimeType: asset.mimeType,
          size: asset.size,
        },
      }));
      setUploadProgress(100);
      setUploadMessage(`${kind === 'image' ? 'Image' : 'File'} uploaded and attached.`);
      setSuccess(false);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : `Failed to upload ${kind}.`);
    } finally {
      setUploadingBlock(null);
    }
  }

  async function uploadMuxVideo(blockKey: string, file: File) {
    setUploadingBlock(blockKey);
    setUploadMessage('Uploading video to Mux...');
    setUploadProgress(0);
    setError(null);

    try {
      const { uploadId } = await uploadVideo({ file, onProgress: setUploadProgress });
      setUploadMessage('Upload complete. Waiting for Mux to create the video asset...');
      let assetId: string | null = null;

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await fetch(`/api/teacher/mux/uploads/${encodeURIComponent(uploadId)}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'Could not retrieve the uploaded Mux video.');
        if (typeof data.assetId === 'string' && data.assetId) {
          assetId = data.assetId;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!assetId)
        throw new Error(
          'Mux has not created the video asset yet. Wait a moment, then choose it from the video library.'
        );
      selectMuxAsset(blockKey, assetId);
      setUploadMessage('Video uploaded and attached. Mux may still be processing it.');
      setUploadProgress(100);
      void loadMuxAssets();
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setUploadingBlock(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">TEACHER WORKSPACE</p>
          <h1 className="text-2xl font-semibold text-gray-900">Edit lesson</h1>
        </div>
        <button
          type="button"
          onClick={saveLesson}
          disabled={saving}
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save lesson'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {uploadMessage && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-sm ${uploadMessage.toLowerCase().includes('failed') || uploadMessage.toLowerCase().includes('could not') ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}`}
        >
          {uploadMessage}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Lesson saved successfully.
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <label htmlFor="lesson-title" className="mb-2 block text-sm font-medium text-gray-700">
            Lesson title
          </label>
          <input
            id="lesson-title"
            value={title}
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              if (!slugManuallyEdited) {
                setSlug(
                  nextTitle
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                );
              }
              setSuccess(false);
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
            placeholder="Enter a lesson title..."
          />
        </div>
        <div>
          <label htmlFor="lesson-slug" className="mb-2 block text-sm font-medium text-gray-700">
            Lesson URL slug
          </label>
          <input
            id="lesson-slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugManuallyEdited(true);
              setSuccess(false);
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            placeholder="lesson-url-slug"
          />
          <p className="mt-1 text-xs text-gray-500">
            Used in the lesson URL. It is normalized and made unique when saved.
          </p>
        </div>
        <div>
          <label
            htmlFor="lesson-description"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            id="lesson-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setSuccess(false);
            }}
            rows={3}
            className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            placeholder="What will learners learn in this lesson?"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Lesson content</h2>
          <p className="text-sm text-gray-500">
            Add, edit, duplicate, remove, and reorder content blocks.
          </p>
        </div>

        {contentBlocks.map((block, index) => (
          <section
            key={block._key}
            className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-gray-900">
                  {(
                    {
                      textBlock: 'Text',
                      videoBlock: 'Video',
                      imageBlock: 'Image',
                      fileBlock: 'File',
                    } as Record<string, string>
                  )[block._type] ?? 'Content'}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  className="rounded-md border px-2 py-1 text-sm disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === contentBlocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  className="rounded-md border px-2 py-1 text-sm disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Duplicate block"
                  onClick={() => duplicateBlock(index)}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  title="Delete block"
                  onClick={() => {
                    setContentBlocks((current) =>
                      current.filter((item) => item._key !== block._key)
                    );
                    setSuccess(false);
                  }}
                  className="rounded-md border border-red-200 px-2 py-1 text-sm text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>

            {block._type === 'textBlock' && (
              <RichTextEditor
                key={`${block._key}-${editorKey}`}
                initialValue={
                  Array.isArray(block.content)
                    ? (block.content as PortableTextBlock[])
                    : (createEmptyTextBlock().content as PortableTextBlock[])
                }
                onChange={(value) => updateBlock(block._key, { content: value })}
              />
            )}

            {block._type === 'videoBlock' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Video title
                  <input
                    value={String(block.title ?? '')}
                    onChange={(event) => updateBlock(block._key, { title: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                  <textarea
                    value={String(block.description ?? '')}
                    onChange={(event) =>
                      updateBlock(block._key, { description: event.target.value })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                    Upload video
                    <input
                      type="file"
                      accept="video/*"
                      className="sr-only"
                      disabled={uploadingBlock !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadMuxVideo(block._key, file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectingVideoFor(block._key);
                      void loadMuxAssets();
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Choose from video library
                  </button>
                  <span className="text-sm text-gray-500">
                    {(block.video as { asset?: { _ref?: string } } | null)?.asset?._ref
                      ? `Selected: ${(block.video as { asset?: { _ref?: string } }).asset?._ref}`
                      : 'No video selected'}
                  </span>
                </div>
                {uploadingBlock === block._key && (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600">{uploadProgress}% uploaded</p>
                  </div>
                )}
              </div>
            )}

            {block._type === 'imageBlock' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Alternative text
                  <input
                    value={String(block.alt ?? '')}
                    onChange={(event) => updateBlock(block._key, { alt: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Describe the image for accessibility"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Caption
                  <input
                    value={String(block.caption ?? '')}
                    onChange={(event) => updateBlock(block._key, { caption: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                    Upload image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="sr-only"
                      disabled={uploadingBlock !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadImageOrFile(block._key, file, 'image');
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {Boolean(
                    (block.image as { asset?: { url?: string } } | null)?.asset?.url ||
                      uploadedAssets[block._key]?.url
                  ) && (
                    <Image
                      src={
                        uploadedAssets[block._key]?.url ||
                        (block.image as { asset?: { url?: string } }).asset?.url ||
                        '' // Provide a default empty string if src is undefined
                      }
                      alt={String(block.alt ?? '')}
                      className="h-24 max-w-xs rounded-lg border object-contain"
                    />
                  )}
                  {(block.image as { asset?: { _ref?: string } } | null)?.asset?._ref && (
                    <span className="text-xs text-green-700">Image attached</span>
                  )}
                </div>
                {uploadingBlock === block._key && (
                  <p className="text-xs text-gray-600">Uploading image...</p>
                )}
              </div>
            )}

            {block._type === 'fileBlock' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Display name
                  <input
                    value={String(block.title ?? '')}
                    onChange={(event) => updateBlock(block._key, { title: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                  <textarea
                    value={String(block.description ?? '')}
                    onChange={(event) =>
                      updateBlock(block._key, { description: event.target.value })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                    Upload file
                    <input
                      type="file"
                      className="sr-only"
                      disabled={uploadingBlock !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadImageOrFile(block._key, file, 'file');
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {(block.file as { asset?: { originalFilename?: string } } | null)?.asset
                    ?.originalFilename && (
                    <span className="text-sm text-green-700">
                      Attached:{' '}
                      {
                        (block.file as { asset?: { originalFilename?: string } }).asset
                          ?.originalFilename
                      }
                    </span>
                  )}
                  {uploadedAssets[block._key]?.filename && (
                    <span className="text-sm text-green-700">
                      Attached: {uploadedAssets[block._key].filename}
                    </span>
                  )}
                </div>
                {uploadingBlock === block._key && (
                  <p className="text-xs text-gray-600">Uploading file...</p>
                )}
              </div>
            )}
          </section>
        ))}

        <div className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
          <button
            type="button"
            onClick={() => setShowAddMenu((current) => !current)}
            className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          >
            + Add additional content
          </button>
          {showAddMenu && (
            <div className="mx-auto mt-4 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['textBlock', 'Text', 'Write formatted lesson content'],
                  ['videoBlock', 'Video', 'Choose a Mux video'],
                  ['imageBlock', 'Image', 'Add an image and caption'],
                  ['fileBlock', 'File', 'Attach a downloadable file'],
                ] as const
              ).map(([type, label, help]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="rounded-lg border border-gray-200 p-4 text-left hover:border-gray-400 hover:bg-gray-50"
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-1 block text-xs text-gray-500">{help}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectingVideoFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mux-picker-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="mux-picker-title" className="text-lg font-semibold">
                Choose a video
              </h2>
              <button
                type="button"
                onClick={() => setSelectingVideoFor(null)}
                className="rounded-md px-3 py-1 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            {muxLoading && <p className="text-sm text-gray-500">Loading video library...</p>}
            {muxError && <p className="text-sm text-red-600">{muxError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {muxAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  disabled={asset.status !== 'ready' || !asset.playbackId}
                  onClick={() => selectMuxAsset(selectingVideoFor, asset.id)}
                  className="flex gap-3 rounded-lg border p-3 text-left hover:bg-gray-50 disabled:opacity-40"
                >
                  {asset.thumbnailUrl ? (
                    <Image
                      src={asset.thumbnailUrl}
                      alt=""
                      className="h-16 w-28 rounded object-cover"
                    />
                  ) : (
                    <span className="h-16 w-28 rounded bg-gray-100" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {asset.title || asset.id}
                    </span>
                    <span className="text-xs capitalize text-gray-500">{asset.status}</span>
                  </span>
                </button>
              ))}
            </div>
            {!muxLoading && muxAssets.length === 0 && !muxError && (
              <p className="text-sm text-gray-500">No videos found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
