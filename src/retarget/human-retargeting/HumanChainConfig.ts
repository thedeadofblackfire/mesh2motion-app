

export class HumanChainConfig {
  // Master list of human bone/joint names that we can use and part of the Mesh2Motion rig
  // this will always be the source config we start with for retargeting
  public static readonly mesh2motion_config: Record<string, string[]> = {
    pelvis: ['DEF-hips'],
    spine: ['DEF-spine001', 'DEF-spine002', 'DEF-spine003'],
    head: ['DEF-neck', 'DEF-head'],
    armL: ['DEF-upper_armL', 'DEF-forearmL', 'DEF-handL'],
    armR: ['DEF-upper_armR', 'DEF-forearmR', 'DEF-handR'],
    legL: ['DEF-thighL', 'DEF-shinL', 'DEF-footL'],
    legR: ['DEF-thighR', 'DEF-shinR', 'DEF-footR'],
    fingersThumbL: ['DEF-thumb01L', 'DEF-thumb02L', 'DEF-thumb03L', 'DEF-thumb04_tipL'],
    fingersThumbR: ['DEF-thumb01R', 'DEF-thumb02R', 'DEF-thumb03R', 'DEF-thumb04_tipR'],
    fingersIndexL: ['DEF-f_index01L', 'DEF-f_index02L', 'DEF-f_index03L', 'DEF-f_index04_tipL'],
    fingersIndexR: ['DEF-f_index01R', 'DEF-f_index02R', 'DEF-f_index03R', 'DEF-f_index04_tipR'],
    fingersMiddleL: ['DEF-f_middle01L', 'DEF-f_middle02L', 'DEF-f_middle03L', 'DEF-f_middle04_tipL'],
    fingersMiddleR: ['DEF-f_middle01R', 'DEF-f_middle02R', 'DEF-f_middle03R', 'DEF-f_middle04_tipR'],
    fingersRingL: ['DEF-f_ring01L', 'DEF-f_ring02L', 'DEF-f_ring03L', 'DEF-f_ring04_tipL'],
    fingersRingR: ['DEF-f_ring01R', 'DEF-f_ring02R', 'DEF-f_ring03R', 'DEF-f_ring04_tipR'],
    fingersPinkyL: ['DEF-f_pinky01L', 'DEF-f_pinky02L', 'DEF-f_pinky03L', 'DEF-f_pinky04_tipL'],
    fingersPinkyR: ['DEF-f_pinky01R', 'DEF-f_pinky02R', 'DEF-f_pinky03R', 'DEF-f_pinky04_tipR']
  }

  public static readonly mixamo_config: Record<string, string[]> = {
    pelvis: ['mixamorigHips'],
    spine: ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'],
    head: ['mixamorigNeck', 'mixamorigHead'],
    armL: ['mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand'],
    armR: ['mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'],
    legL: ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot'],
    legR: ['mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot'],
    fingersThumbL: ['mixamorigLeftHandThumb1', 'mixamorigLeftHandThumb2', 'mixamorigLeftHandThumb3', 'mixamorigLeftHandThumb4'],
    fingersThumbR: ['mixamorigRightHandThumb1', 'mixamorigRightHandThumb2', 'mixamorigRightHandThumb3', 'mixamorigRightHandThumb4'],
    fingersIndexL: ['mixamorigLeftHandIndex1', 'mixamorigLeftHandIndex2', 'mixamorigLeftHandIndex3', 'mixamorigLeftHandIndex4'],
    fingersIndexR: ['mixamorigRightHandIndex1', 'mixamorigRightHandIndex2', 'mixamorigRightHandIndex3', 'mixamorigRightHandIndex4'],
    fingersMiddleL: ['mixamorigLeftHandMiddle1', 'mixamorigLeftHandMiddle2', 'mixamorigLeftHandMiddle3', 'mixamorigLeftHandMiddle4'],
    fingersMiddleR: ['mixamorigRightHandMiddle1', 'mixamorigRightHandMiddle2', 'mixamorigRightHandMiddle3', 'mixamorigRightHandMiddle4'],
    fingersRingL: ['mixamorigLeftHandRing1', 'mixamorigLeftHandRing2', 'mixamorigLeftHandRing3', 'mixamorigLeftHandRing4'],
    fingersRingR: ['mixamorigRightHandRing1', 'mixamorigRightHandRing2', 'mixamorigRightHandRing3', 'mixamorigRightHandRing4'],
    fingersPinkyL: ['mixamorigLeftHandPinky1', 'mixamorigLeftHandPinky2', 'mixamorigLeftHandPinky3', 'mixamorigLeftHandPinky4'],
    fingersPinkyR: ['mixamorigRightHandPinky1', 'mixamorigRightHandPinky2', 'mixamorigRightHandPinky3', 'mixamorigRightHandPinky4']
  }

  // TODO: Have this algorithm work for ALL humanoid rigs, not just Mixamo
  // right now they just use the simple bone mapping...which will have issues with bone roll
  // the retargeting algorithm needs a source config and a target config for it to work
  // this configuration will store the "chains" of joints for both source and target rigs
  // we have all the source joints since that is the Mesh2Motion rigs, but we might not
  // have all the target joints. We will need to effectively clone this "master" config and 
  // modify it to only includes bones that are part of the mapping

  // then we can duplicate that source config to a target config. We can go through the bone
  // mapping and swap out all the source bone names for the target bone names

  public static build_custom_source_config (bone_mapping: Map<string, string>): Record<string, string[]> {
    // we will bring in the bones that are mapped
    const base_source_config = structuredClone(HumanChainConfig.mesh2motion_config)
    const flat_source_bone_names: string = this.flat_bone_name_list(bone_mapping.values()) // values store the Mesh2Motion bones

    // TODO: Go through each chain and bone. If the bone has a bone mapping, keep it, if not, replace the value with an empty string
    for (const chain_name in base_source_config) {
      const bone_names_in_chain = base_source_config[chain_name]
      for (let i = 0; i < bone_names_in_chain.length; i++) {
        const bone_name = bone_names_in_chain[i]
        if (!flat_source_bone_names.includes(bone_name)) {
          // no mapping for this bone, so we will replace it with an empty string
          bone_names_in_chain[i] = ''
        }
      }
    }

    console.log('Custom Source Config has been CREATED!!!:', base_source_config)

    return base_source_config
  }

  /**
   * To speed up finding bones in the list of chains and list of bones, flatten everything for faster searching
   * @param bone_config
   * @returns string of all the bone names separated by commas
   */
  private static flat_bone_name_list (bones_list: MapIterator<string>): string {
    let easy_searchable_bone_names: string = ''

    // flatten all keys (source bone names)
    for (const key of bones_list) {
      easy_searchable_bone_names += key + ','
    }
    return easy_searchable_bone_names
  }

  public static build_custom_target_config (source_config: Record<string, string[]>, bone_mapping: Map<string, string>): Record<string, string[]> {
    // swap the keys with value since it puts the Mesh2Motion bone names as values
    const reverse_bone_mapping = new Map(Array.from(bone_mapping.entries()).map(([key, value]) => [value, key]))

    // our source config will only have the bones that need to be mapped. Non-mapped bones will be empty strings
    const custom_target_config: Record<string, string[]> = structuredClone(source_config)

    // we can go through each chain and bone in the source config. If there is no bone mapping done, we want to replace it with an empty string
    // we will have to later update the retargeting algorithm to handle bones that are effectively skipped
    for (const chain_name in custom_target_config) {
      const bone_names = custom_target_config[chain_name]
      for (let i = 0; i < bone_names.length; i++) {
        const source_bone_name = bone_names[i]

        if (source_bone_name === '') { continue } // no source bone name, so skip it

        // update bone with mapped target bone name
        const target_bone_name = reverse_bone_mapping.get(source_bone_name)
        if (target_bone_name !== undefined) {
          bone_names[i] = target_bone_name
        } else {
          console.warn('No target bone mapping found for source bone. This should NOT happen:', source_bone_name)
          bone_names[i] = ''
        }
      }
    }

    console.log('Custom Target Config has been CREATED!!!:', custom_target_config)
    return custom_target_config
  }
}
