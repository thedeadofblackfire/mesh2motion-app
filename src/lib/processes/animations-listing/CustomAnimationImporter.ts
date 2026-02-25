import { UI } from '../../UI.ts'
import { ModalDialog } from '../../ModalDialog.ts'
import { type SkinnedMesh } from 'three'
import { AnimationLoader, NoAnimationsError, IncompatibleSkeletonError, LoadError } from './AnimationLoader.ts'
import { type TransformedAnimationClipPair } from './interfaces/TransformedAnimationClipPair.ts'

/**
 * Handles the importing of custom animations from GLB files.
 * This class encapsulates the UI and logic for the import process.
 */
export class CustomAnimationImporter {
  private readonly ui: UI
  private readonly animation_loader: AnimationLoader
  private readonly get_skinned_meshes: () => SkinnedMesh[]
  private readonly get_skeleton_scale: () => number
  private readonly is_loading_default_animations: () => boolean
  private readonly on_import_success: (new_clips: TransformedAnimationClipPair[]) => void

  constructor (
    animation_loader: AnimationLoader,
    get_skinned_meshes: () => SkinnedMesh[],
    get_skeleton_scale: () => number,
    is_loading_default_animations: () => boolean,
    on_import_success: (new_clips: TransformedAnimationClipPair[]) => void
  ) {
    this.ui = UI.getInstance()
    this.animation_loader = animation_loader
    this.get_skinned_meshes = get_skinned_meshes
    this.get_skeleton_scale = get_skeleton_scale
    this.is_loading_default_animations = is_loading_default_animations
    this.on_import_success = on_import_success
  }

  public add_event_listeners (): void {
    this.ui.dom_import_animations_button?.addEventListener('click', () => {
      if (this.ui.dom_import_animations_button?.disabled === true || this.is_loading_default_animations()) {
        return
      }
      this.ui.dom_import_animations_input?.click()
    })

    this.ui.dom_import_animations_input?.addEventListener('change', async (event) => {
      if (this.ui.dom_import_animations_button?.disabled === true || this.is_loading_default_animations()) {
        return
      }
      const input = event.target as HTMLInputElement
      const files = input.files
      if (files === null || files.length === 0) {
        return
      }

      const import_button = this.ui.dom_import_animations_button
      const previous_disabled_state: boolean | undefined = import_button?.disabled
      if (import_button != null) {
        import_button.disabled = true
      }

      try {
        for (const file of Array.from(files)) {
          const file_name = file.name.toLowerCase()
          if (!file_name.endsWith('.glb')) {
            new ModalDialog('Unsupported file type. Please select a GLB file.', 'Error').show()
            continue
          }
          await this.import_animation_glb(file)
        }
      } finally {
        input.value = ''
        if (import_button != null && previous_disabled_state !== undefined) {
          import_button.disabled = previous_disabled_state
        }
      }
    })
  }

  private async import_animation_glb (file: File): Promise<{ success: boolean, clipCount: number }> {
    try {
      const new_animation_clips = await this.animation_loader.load_animations_from_file(
        file,
        this.get_skinned_meshes(),
        this.get_skeleton_scale()
      )

      this.on_import_success(new_animation_clips)

      // Show success message only for user imports (not default animations)
      if (!this.is_loading_default_animations()) {
        const animation_count = new_animation_clips.length
        const animation_word = animation_count === 1 ? 'animation' : 'animations'
        new ModalDialog(
          'success',
          `${animation_count} ${animation_word} imported successfully`
        ).show()
      }

      return { success: true, clipCount: new_animation_clips.length }
    } catch (error) {
      console.error('Failed to import animations:', error)

      if (error instanceof NoAnimationsError) {
        new ModalDialog('import error', 'no animations found in that glb file').show()
        return { success: false, clipCount: 0 }
      }

      if (error instanceof IncompatibleSkeletonError) {
        const error_message = error.message === 'bone_count_mismatch'
          ? 'bone count mismatch'
          : 'bone names don\'t match'
        new ModalDialog('import error', error_message).show()
        return { success: false, clipCount: 0 }
      }

      if (error instanceof LoadError) {
        new ModalDialog('import error', 'failed to load the animation file').show()
        return { success: false, clipCount: 0 }
      }

      // Unknown error
      new ModalDialog('import error', 'failed to import animations from the glb file').show()
      return { success: false, clipCount: 0 }
    }
  }
}
