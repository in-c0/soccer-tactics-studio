import { CAMERA_PRESETS } from './camera';
import { listSituations } from './capture';
import { POSE_LABELS } from './player';
import { addPlayer, defaultScenario, store, uid } from './state';
import { POSES, type Annotation, type PlayerState, type TeamId, type TextOverlay } from './types';
import * as U from './ui';

export interface PanelActions {
  exportPNG(scale: number): void;
  copyPNG(): void;
  saveSituation(): void;
  loadSituation(id: string): void;
  deleteSituation(id: string): void;
  saveFile(): void;
  loadFile(): void;
  addText(): void;
  frameOn(x: number, z: number): void;
}

const KIND_GLYPH: Record<Annotation['kind'], string> = {
  path: '↝',
  arc: '⌒',
  kick: '➤',
  zone: '▱',
};

export class Panel {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private actions: PanelActions) {
    this.root = U.h('aside', { class: 'panel' });
    parent.appendChild(this.root);
  }

  render(): void {
    const s = store.state;
    const sel = store.selection;
    this.root.replaceChildren(
      this.situationSection(),
      this.cameraSection(),
      this.throwSection(),
      this.playersSection(sel?.type === 'player' ? sel.id : null),
      this.teamsSection(),
      this.ballSection(),
      this.annotationsSection(sel?.type === 'annotation' ? sel.id : null),
      this.textsSection(sel?.type === 'text' ? sel.id : null),
      this.minimapSection(),
      this.pitchSection()
    );
    void s;
  }

  private r(): void {
    store.touch('render');
  }
  private ui(): void {
    store.touch('ui');
  }

  // -------------------------------------------------------------- situation
  private situationSection(): HTMLElement {
    const s = store.state;
    const saved = listSituations();
    return U.section(
      'Situation',
      U.textInput('Name', s.name, (v) => {
        s.name = v;
      }),
      U.textArea('Notes', s.notes, (v) => {
        s.notes = v;
      }),
      U.buttonRow(
        U.button('Capture PNG', () => this.actions.exportPNG(1), 'primary'),
        U.button('PNG @2x', () => this.actions.exportPNG(2)),
        U.button('Copy', () => this.actions.copyPNG())
      ),
      U.buttonRow(
        U.button('Save situation', () => this.actions.saveSituation(), 'primary'),
        U.button('Export .json', () => this.actions.saveFile()),
        U.button('Import', () => this.actions.loadFile())
      ),
      U.buttonRow(
        U.button('Reset to demo', () => {
          if (confirm('Discard the current situation and reload the demo?')) store.replace(defaultScenario());
        }, 'danger')
      ),
      saved.length
        ? U.h(
            'div',
            { class: 'saved-list' },
            ...saved.map((sit) =>
              U.h(
                'div',
                { class: 'saved-item', onclick: () => this.actions.loadSituation(sit.id) },
                sit.thumb ? U.h('img', { src: sit.thumb, alt: '' }) : U.h('div', { class: 'thumb-empty' }),
                U.h(
                  'div',
                  { class: 'saved-meta' },
                  U.h('strong', {}, sit.name),
                  U.h('small', {}, new Date(sit.savedAt).toLocaleString())
                ),
                U.iconButton('✕', 'Delete', () => this.actions.deleteSituation(sit.id))
              )
            )
          )
        : U.note('No saved situations yet — “Save situation” keeps a snapshot in this browser.')
    );
  }

  // ----------------------------------------------------------------- camera
  private cameraSection(): HTMLElement {
    const c = store.state.camera;
    const fpv = c.mode === 'fpv';
    return U.section(
      'Camera',
      U.h(
        'div',
        { class: 'btn-row' },
        ...CAMERA_PRESETS.map((p) =>
          U.button(p.label, () => {
            p.apply(c, store.thrower);
            this.ui();
          })
        )
      ),
      U.select(
        'Mode',
        c.mode,
        [
          ['orbit', 'Orbit / free'],
          ['fpv', 'First person (thrower)'],
        ],
        (v) => {
          c.mode = v;
          this.ui();
        }
      ),
      fpv
        ? U.h(
            'div',
            { class: 'group' },
            U.check('Yaw follows the thrower’s facing', c.fpv.followHeading, (v) => {
              c.fpv.followHeading = v;
              this.ui();
            }),
            c.fpv.followHeading
              ? null
              : U.slider('Look yaw °', c.fpv.yaw, -180, 360, 1, (v) => {
                  c.fpv.yaw = v;
                  this.r();
                }),
            U.slider('Look pitch °', c.fpv.pitch, -80, 80, 1, (v) => {
              c.fpv.pitch = v;
              this.r();
            }),
            U.slider('Eye height m', c.fpv.eyeHeight, 0.3, 3.2, 0.01, (v) => {
              c.fpv.eyeHeight = v;
              this.r();
            }),
            U.slider('Offset forward m', c.fpv.forward, -6, 6, 0.05, (v) => {
              c.fpv.forward = v;
              this.r();
            }),
            U.slider('Offset lateral m', c.fpv.lateral, -6, 6, 0.05, (v) => {
              c.fpv.lateral = v;
              this.r();
            }),
            U.slider('Field of view °', c.fpv.fov, 25, 120, 1, (v) => {
              c.fpv.fov = v;
              this.r();
            }),
            U.check('Show the thrower’s own body', c.fpv.showSelf, (v) => {
              c.fpv.showSelf = v;
              this.r();
            }),
            U.note('Drag in the viewport to look around.')
          )
        : U.h(
            'div',
            { class: 'group' },
            U.slider('Field of view °', c.fov, 15, 110, 1, (v) => {
              c.fov = v;
              this.r();
            }),
            U.slider('Camera X', c.pos.x, -140, 140, 0.5, (v) => {
              c.pos.x = v;
              this.r();
            }),
            U.slider('Camera Y', c.pos.y, 0.2, 140, 0.5, (v) => {
              c.pos.y = v;
              this.r();
            }),
            U.slider('Camera Z', c.pos.z, -140, 140, 0.5, (v) => {
              c.pos.z = v;
              this.r();
            }),
            U.slider('Target X', c.target.x, -70, 70, 0.5, (v) => {
              c.target.x = v;
              this.r();
            }),
            U.slider('Target Y', c.target.y, 0, 20, 0.1, (v) => {
              c.target.y = v;
              this.r();
            }),
            U.slider('Target Z', c.target.z, -50, 50, 0.5, (v) => {
              c.target.z = v;
              this.r();
            }),
            U.note('Drag to orbit, right-drag to pan, wheel to zoom.')
          )
    );
  }

  // ------------------------------------------------------------ throw range
  private throwSection(): HTMLElement {
    const s = store.state;
    const t = s.throwSettings;
    return U.section(
      'Thrower & range',
      U.select(
        'Thrower',
        s.throwerId ?? '',
        [['', '— none —'] as [string, string]].concat(
          s.players.map((p) => [p.id, `#${p.number} ${p.name} (${s.teams[p.team].name})`] as [string, string])
        ),
        (v) => {
          s.throwerId = v || null;
          this.ui();
        }
      ),
      U.check('Max-distance circle', t.showCircle, (v) => {
        t.showCircle = v;
        this.ui();
      }),
      t.showCircle
        ? U.h(
            'div',
            { class: 'group' },
            U.slider('Max distance m', t.maxDistance, 4, 60, 0.5, (v) => {
              t.maxDistance = v;
              this.r();
            }),
            U.color('Circle colour', t.circleColor, (v) => {
              t.circleColor = v;
              this.r();
            }),
            U.slider('Fill opacity', t.circleOpacity, 0, 1, 0.01, (v) => {
              t.circleOpacity = v;
              this.r();
            }),
            U.slider('Line width m', t.circleLineWidth, 0.04, 1, 0.01, (v) => {
              t.circleLineWidth = v;
              this.r();
            }),
            U.slider('Distance rings every m', t.ringStep, 0, 20, 1, (v) => {
              t.ringStep = v;
              this.r();
            })
          )
        : null,
      U.check('Target cone / sector', t.showCone, (v) => {
        t.showCone = v;
        this.ui();
      }),
      t.showCone
        ? U.h(
            'div',
            { class: 'group' },
            U.check('Follow the thrower’s facing', t.coneFollowsThrower, (v) => {
              t.coneFollowsThrower = v;
              this.ui();
            }),
            t.coneFollowsThrower
              ? null
              : U.slider('Cone heading °', t.coneHeading, 0, 360, 1, (v) => {
                  t.coneHeading = v;
                  this.r();
                }),
            U.slider('Half angle °', t.coneHalfAngle, 2, 180, 1, (v) => {
              t.coneHalfAngle = v;
              this.r();
            }),
            U.slider('Cone reach m', t.coneRange, 2, 60, 0.5, (v) => {
              t.coneRange = v;
              this.r();
            }),
            U.slider('Inner cutoff m', t.coneMinRange, 0, 30, 0.5, (v) => {
              t.coneMinRange = v;
              this.r();
            }),
            U.color('Cone colour', t.coneColor, (v) => {
              t.coneColor = v;
              this.r();
            }),
            U.slider('Cone opacity', t.coneOpacity, 0, 1, 0.01, (v) => {
              t.coneOpacity = v;
              this.r();
            }),
            U.check('Show the 3D throw volume', t.coneVolume, (v) => {
              t.coneVolume = v;
              this.ui();
            }),
            t.coneVolume
              ? U.slider('Volume opacity', t.coneVolumeOpacity, 0, 0.8, 0.01, (v) => {
                  t.coneVolumeOpacity = v;
                  this.r();
                })
              : null
          )
        : null,
      U.slider('Release height m', t.releaseHeight, 0.5, 3.5, 0.05, (v) => {
        t.releaseHeight = v;
        this.r();
      }),
      U.check('Draw range on the minimap', t.showOnMap, (v) => {
        t.showOnMap = v;
        this.r();
      })
    );
  }

  // ---------------------------------------------------------------- players
  private playersSection(selectedId: string | null): HTMLElement {
    const s = store.state;
    const rows = s.players.map((p) =>
      U.listRow(
        `#${p.number}  ${p.name}`,
        p.id === selectedId,
        () => store.select({ type: 'player', id: p.id }),
        s.teams[p.team].mapColor,
        [
          U.iconButton(p.visible ? '👁' : '🚫', 'Toggle visibility', () => {
            p.visible = !p.visible;
            this.ui();
          }),
          U.iconButton('⧉', 'Duplicate', () => {
            const copy: PlayerState = { ...p, id: uid('p'), x: p.x + 2, z: p.z + 2, highlight: false };
            s.players.push(copy);
            store.select({ type: 'player', id: copy.id });
          }),
          U.iconButton('✕', 'Remove', () => {
            s.players = s.players.filter((q) => q.id !== p.id);
            if (s.throwerId === p.id) s.throwerId = s.players[0]?.id ?? null;
            store.select(null);
          }),
        ]
      )
    );

    const p = selectedId ? store.player(selectedId) : undefined;
    return U.section(
      'Players',
      U.buttonRow(
        U.button('+ Home player', () => {
          const np = addPlayer('home');
          store.select({ type: 'player', id: np.id });
        }),
        U.button('+ Away player', () => {
          const np = addPlayer('away');
          store.select({ type: 'player', id: np.id });
        })
      ),
      U.h('div', { class: 'list' }, ...rows),
      p ? this.playerInspector(p) : U.note('Select a player — or click one in the 3D view or on the minimap.')
    );
  }

  private playerInspector(p: PlayerState): HTMLElement {
    const s = store.state;
    return U.h(
      'div',
      { class: 'group inspector' },
      U.h('h4', {}, `#${p.number} ${p.name}`),
      U.textInput(
        'Name',
        p.name,
        (v) => {
          p.name = v;
          this.r();
        },
        () => this.ui()
      ),
      U.number('Shirt number', p.number, 1, (v) => {
        p.number = Math.max(0, Math.round(v));
        this.r();
      }),
      U.select(
        'Team',
        p.team,
        [
          ['home', s.teams.home.name],
          ['away', s.teams.away.name],
        ] as [TeamId, string][],
        (v) => {
          p.team = v;
          this.r();
        }
      ),
      U.slider('Position X m', p.x, -54, 54, 0.1, (v) => {
        p.x = v;
        this.r();
      }),
      U.slider('Position Z m', p.z, -35, 35, 0.1, (v) => {
        p.z = v;
        this.r();
      }),
      U.slider('Facing °', p.heading, 0, 360, 1, (v) => {
        p.heading = v;
        this.r();
      }),
      U.select(
        'Pose',
        p.pose,
        POSES.map((id) => [id, POSE_LABELS[id]] as [typeof id, string]),
        (v) => {
          p.pose = v;
          this.r();
        }
      ),
      U.check('Mirror pose', p.mirror, (v) => {
        p.mirror = v;
        this.r();
      }),
      U.slider('Opacity', p.opacity, 0, 1, 0.01, (v) => {
        p.opacity = v;
        this.r();
      }),
      U.slider('Height m', p.height, 1.4, 2.15, 0.01, (v) => {
        p.height = v;
        this.r();
      }),
      U.check('Visible', p.visible, (v) => {
        p.visible = v;
        this.r();
      }),
      U.check('Highlight ring', p.highlight, (v) => {
        p.highlight = v;
        this.ui();
      }),
      p.highlight
        ? U.color('Ring colour', p.highlightColor, (v) => {
            p.highlightColor = v;
            this.r();
          })
        : null,
      U.check('Custom kit (keeper, bib…)', !!p.kitOverride, (v) => {
        p.kitOverride = v ? { ...s.teams[p.team] } : null;
        this.ui();
      }),
      p.kitOverride
        ? U.h(
            'div',
            { class: 'group' },
            U.color('Jersey', p.kitOverride.jersey, (v) => {
              p.kitOverride!.jersey = v;
              this.r();
            }),
            U.color('Shorts', p.kitOverride.shorts, (v) => {
              p.kitOverride!.shorts = v;
              this.r();
            }),
            U.color('Socks', p.kitOverride.socks, (v) => {
              p.kitOverride!.socks = v;
              this.r();
            }),
            U.color('Skin', p.kitOverride.skin, (v) => {
              p.kitOverride!.skin = v;
              this.r();
            }),
            U.color('Number', p.kitOverride.numberColor, (v) => {
              p.kitOverride!.numberColor = v;
              this.r();
            })
          )
        : null,
      U.buttonRow(
        U.button('Make thrower', () => {
          s.throwerId = p.id;
          this.ui();
        }),
        U.button('Frame camera', () => this.actions.frameOn(p.x, p.z))
      )
    );
  }

  // ------------------------------------------------------------------ teams
  private teamsSection(): HTMLElement {
    const s = store.state;
    const teamUI = (id: TeamId) => {
      const t = s.teams[id];
      return U.h(
        'div',
        { class: 'group' },
        U.h('h4', {}, id === 'home' ? 'Home' : 'Away'),
        U.textInput(
          'Team name',
          t.name,
          (v) => {
            t.name = v;
          },
          () => this.ui()
        ),
        U.color('Jersey', t.jersey, (v) => {
          t.jersey = v;
          this.r();
        }),
        U.color('Shorts', t.shorts, (v) => {
          t.shorts = v;
          this.r();
        }),
        U.color('Socks', t.socks, (v) => {
          t.socks = v;
          this.r();
        }),
        U.color('Skin tone', t.skin, (v) => {
          t.skin = v;
          this.r();
        }),
        U.color('Shirt number', t.numberColor, (v) => {
          t.numberColor = v;
          this.r();
        }),
        U.color('Minimap marker', t.mapColor, (v) => {
          t.mapColor = v;
          this.r();
        }),
        U.color('Minimap number', t.mapTextColor, (v) => {
          t.mapTextColor = v;
          this.r();
        })
      );
    };
    return U.section('Teams & kits', teamUI('home'), teamUI('away'));
  }

  // ------------------------------------------------------------------- ball
  private ballSection(): HTMLElement {
    const b = store.state.ball;
    return U.section(
      'Ball',
      U.check('Visible', b.visible, (v) => {
        b.visible = v;
        this.r();
      }),
      U.check('Held by the thrower', b.heldByThrower, (v) => {
        b.heldByThrower = v;
        this.ui();
      }),
      b.heldByThrower
        ? U.note('The ball tracks the thrower’s hands — pose changes move it.')
        : U.h(
            'div',
            { class: 'group' },
            U.slider('X m', b.x, -54, 54, 0.1, (v) => {
              b.x = v;
              this.r();
            }),
            U.slider('Height m', b.y, 0.11, 12, 0.05, (v) => {
              b.y = v;
              this.r();
            }),
            U.slider('Z m', b.z, -35, 35, 0.1, (v) => {
              b.z = v;
              this.r();
            })
          ),
      U.slider('Scale', b.scale, 0.5, 4, 0.05, (v) => {
        b.scale = v;
        this.r();
      }),
      U.color('Base colour', b.color, (v) => {
        b.color = v;
        this.r();
      }),
      U.color('Panel colour', b.accentColor, (v) => {
        b.accentColor = v;
        this.r();
      })
    );
  }

  // ------------------------------------------------------------- annotations
  private annotationsSection(selectedId: string | null): HTMLElement {
    const s = store.state;
    const rows = s.annotations.map((a) =>
      U.listRow(
        `${KIND_GLYPH[a.kind]}  ${a.label}`,
        a.id === selectedId,
        () => store.select({ type: 'annotation', id: a.id }),
        a.style.color,
        [
          U.iconButton(a.visible ? '👁' : '🚫', 'Toggle visibility', () => {
            a.visible = !a.visible;
            this.ui();
          }),
          U.iconButton('⧉', 'Duplicate', () => {
            const copy: Annotation = JSON.parse(JSON.stringify(a));
            copy.id = uid('an');
            copy.label = `${a.label} copy`;
            s.annotations.push(copy);
            store.select({ type: 'annotation', id: copy.id });
          }),
          U.iconButton('✕', 'Remove', () => {
            s.annotations = s.annotations.filter((x) => x.id !== a.id);
            store.select(null);
          }),
        ]
      )
    );
    const a = selectedId ? store.annotation(selectedId) : undefined;
    return U.section(
      'Arrows & zones',
      U.buttonRow(
        U.button('Draw run', () => store.setMode('draw-path')),
        U.button('Throw arc', () => store.setMode('draw-arc')),
        U.button('Kick arrow', () => store.setMode('draw-kick')),
        U.button('Zone', () => store.setMode('draw-zone'))
      ),
      U.note('Click on the pitch or the minimap to drop points. Enter or double-click finishes, Esc cancels.'),
      U.h('div', { class: 'list' }, ...rows),
      a ? this.annotationInspector(a) : null
    );
  }

  private annotationInspector(a: Annotation): HTMLElement {
    const st = a.style;
    return U.h(
      'div',
      { class: 'group inspector' },
      U.textInput(
        'Label',
        a.label,
        (v) => {
          a.label = v;
        },
        () => this.ui()
      ),
      U.select(
        'Type',
        a.kind,
        [
          ['path', 'Run / pathway'],
          ['arc', 'Throw arc (3D)'],
          ['kick', 'Kick direction'],
          ['zone', 'Zone'],
        ] as [Annotation['kind'], string][],
        (v) => {
          a.kind = v;
          this.ui();
        }
      ),
      U.color('Colour', st.color, (v) => {
        st.color = v;
        this.r();
      }),
      U.slider('Width m', st.width, 0.05, 2, 0.01, (v) => {
        st.width = v;
        this.r();
      }),
      U.slider('Opacity', st.opacity, 0.05, 1, 0.01, (v) => {
        st.opacity = v;
        this.r();
      }),
      U.check('Dotted / dashed', st.dashed, (v) => {
        st.dashed = v;
        this.ui();
      }),
      st.dashed
        ? U.h(
            'div',
            { class: 'group' },
            U.slider('Dash length m', st.dashLength, 0.1, 6, 0.05, (v) => {
              st.dashLength = v;
              this.r();
            }),
            U.slider('Gap length m', st.gapLength, 0.05, 6, 0.05, (v) => {
              st.gapLength = v;
              this.r();
            })
          )
        : null,
      a.kind === 'zone'
        ? null
        : U.select(
            'Arrow heads',
            st.head,
            [
              ['end', 'At the end'],
              ['both', 'Both ends'],
              ['none', 'None'],
            ] as [typeof st.head, string][],
            (v) => {
              st.head = v;
              this.r();
            }
          ),
      st.head === 'none' || a.kind === 'zone'
        ? null
        : U.slider('Head size', st.headSize, 0.2, 4, 0.05, (v) => {
            st.headSize = v;
            this.r();
          }),
      a.kind === 'arc'
        ? U.h(
            'div',
            { class: 'group' },
            U.slider('Apex height m', a.apex, 0, 25, 0.1, (v) => {
              a.apex = v;
              this.r();
            }),
            U.slider('Release height m', a.startHeight, 0, 4, 0.05, (v) => {
              a.startHeight = v;
              this.r();
            }),
            U.slider('Landing height m', a.endHeight, 0, 4, 0.05, (v) => {
              a.endHeight = v;
              this.r();
            })
          )
        : U.slider('Ground clearance m', st.elevation, 0, 3, 0.01, (v) => {
            st.elevation = v;
            this.r();
          }),
      a.points.length === 2 && a.kind !== 'zone'
        ? U.slider('Sideways bend m', a.bend, -30, 30, 0.5, (v) => {
            a.bend = v;
            this.r();
          })
        : null,
      U.check('Show in 3D', a.showIn3D, (v) => {
        a.showIn3D = v;
        this.r();
      }),
      U.check('Show on the minimap', a.showOnMap, (v) => {
        a.showOnMap = v;
        this.r();
      }),
      U.h('h4', {}, 'Points'),
      ...a.points.map((pt, i) =>
        U.h(
          'div',
          { class: 'point-row' },
          U.h('span', { class: 'idx' }, String(i + 1)),
          this.pointNum(pt, 'x'),
          this.pointNum(pt, 'z'),
          U.iconButton('✕', 'Remove point', () => {
            if (a.points.length <= 2) return;
            a.points.splice(i, 1);
            this.ui();
          })
        )
      ),
      U.buttonRow(
        U.button('+ Point', () => {
          const last = a.points[a.points.length - 1];
          const prev = a.points[a.points.length - 2] ?? { x: last.x - 4, z: last.z };
          a.points.push({ x: last.x + (last.x - prev.x), z: last.z + (last.z - prev.z) });
          this.ui();
        }),
        U.button('Redraw', () => store.setMode(`draw-${a.kind}` as never))
      )
    );
  }

  private pointNum(pt: { x: number; z: number }, key: 'x' | 'z'): HTMLElement {
    const inp = U.h('input', { type: 'number', step: 0.1, value: pt[key], class: 'num' }) as HTMLInputElement;
    inp.addEventListener('input', () => {
      pt[key] = Number(inp.value);
      this.r();
    });
    return U.h('label', { class: 'point-num' }, U.h('span', {}, key.toUpperCase()), inp);
  }

  // ------------------------------------------------------------------ texts
  private textsSection(selectedId: string | null): HTMLElement {
    const s = store.state;
    const rows = s.texts.map((t) =>
      U.listRow(
        t.text.split('\n')[0].slice(0, 28) || '(empty)',
        t.id === selectedId,
        () => store.select({ type: 'text', id: t.id }),
        t.color,
        [
          U.iconButton(t.visible ? '👁' : '🚫', 'Toggle visibility', () => {
            t.visible = !t.visible;
            this.ui();
          }),
          U.iconButton('⧉', 'Duplicate', () => {
            const copy: TextOverlay = { ...JSON.parse(JSON.stringify(t)), id: uid('tx'), sy: Math.min(0.9, t.sy + 0.06) };
            s.texts.push(copy);
            store.select({ type: 'text', id: copy.id });
          }),
          U.iconButton('✕', 'Remove', () => {
            s.texts = s.texts.filter((x) => x.id !== t.id);
            store.select(null);
          }),
        ]
      )
    );
    const t = selectedId ? store.text(selectedId) : undefined;
    return U.section(
      'Text overlays',
      U.buttonRow(
        U.button('+ Screen label', () => this.actions.addText()),
        U.button('Pin to the pitch', () => store.setMode('place-text'))
      ),
      U.h('div', { class: 'list' }, ...rows),
      t ? this.textInspector(t) : null
    );
  }

  private textInspector(t: TextOverlay): HTMLElement {
    const ta = U.h('textarea', { rows: 3 }) as HTMLTextAreaElement;
    ta.value = t.text;
    ta.addEventListener('input', () => {
      t.text = ta.value;
      this.r();
    });
    ta.addEventListener('change', () => this.ui());
    return U.h(
      'div',
      { class: 'group inspector' },
      U.field('Text', ta),
      U.select(
        'Anchor',
        t.anchor,
        [
          ['screen', 'Fixed on screen'],
          ['world', 'Pinned to the pitch'],
        ] as [TextOverlay['anchor'], string][],
        (v) => {
          t.anchor = v;
          this.ui();
        }
      ),
      t.anchor === 'screen'
        ? U.h(
            'div',
            { class: 'group' },
            U.slider('Screen X', t.sx, 0, 1, 0.001, (v) => {
              t.sx = v;
              this.r();
            }),
            U.slider('Screen Y', t.sy, 0, 1, 0.001, (v) => {
              t.sy = v;
              this.r();
            })
          )
        : U.h(
            'div',
            { class: 'group' },
            U.slider('Pitch X m', t.wx, -54, 54, 0.1, (v) => {
              t.wx = v;
              this.r();
            }),
            U.slider('Height m', t.wy, 0, 20, 0.1, (v) => {
              t.wy = v;
              this.r();
            }),
            U.slider('Pitch Z m', t.wz, -35, 35, 0.1, (v) => {
              t.wz = v;
              this.r();
            }),
            U.check('Leader line to the ground', t.leader, (v) => {
              t.leader = v;
              this.r();
            })
          ),
      U.slider('Font size px', t.fontSize, 8, 96, 1, (v) => {
        t.fontSize = v;
        this.r();
      }),
      U.select(
        'Weight',
        String(t.fontWeight),
        [
          ['300', 'Light'],
          ['400', 'Regular'],
          ['600', 'Semibold'],
          ['700', 'Bold'],
          ['900', 'Black'],
        ],
        (v) => {
          t.fontWeight = Number(v);
          this.r();
        }
      ),
      U.select(
        'Font',
        t.fontFamily,
        [
          ['Inter, system-ui, sans-serif', 'Sans'],
          ['Georgia, serif', 'Serif'],
          ['"JetBrains Mono", ui-monospace, monospace', 'Mono'],
          ['"Arial Black", Impact, sans-serif', 'Impact'],
        ],
        (v) => {
          t.fontFamily = v;
          this.r();
        }
      ),
      U.color('Text colour', t.color, (v) => {
        t.color = v;
        this.r();
      }),
      U.select(
        'Align',
        t.align,
        [
          ['left', 'Left'],
          ['center', 'Centre'],
          ['right', 'Right'],
        ] as [TextOverlay['align'], string][],
        (v) => {
          t.align = v;
          this.r();
        }
      ),
      U.slider('Line height', t.lineHeight, 0.9, 2.4, 0.05, (v) => {
        t.lineHeight = v;
        this.r();
      }),
      U.slider('Letter spacing px', t.letterSpacing, -3, 12, 0.1, (v) => {
        t.letterSpacing = v;
        this.r();
      }),
      U.slider('Opacity', t.opacity, 0.05, 1, 0.01, (v) => {
        t.opacity = v;
        this.r();
      }),
      U.check('Background', t.bg, (v) => {
        t.bg = v;
        this.ui();
      }),
      t.bg
        ? U.h(
            'div',
            { class: 'group' },
            U.colorAlpha('Background colour', t.bgColor, (v) => {
              t.bgColor = v;
              this.r();
            }),
            U.slider('Padding X px', t.bgPadX, 0, 60, 1, (v) => {
              t.bgPadX = v;
              this.r();
            }),
            U.slider('Padding Y px', t.bgPadY, 0, 60, 1, (v) => {
              t.bgPadY = v;
              this.r();
            }),
            U.slider('Corner radius px', t.bgRadius, 0, 40, 1, (v) => {
              t.bgRadius = v;
              this.r();
            })
          )
        : null,
      U.check('Border', t.border, (v) => {
        t.border = v;
        this.ui();
      }),
      t.border
        ? U.h(
            'div',
            { class: 'group' },
            U.color('Border colour', t.borderColor, (v) => {
              t.borderColor = v;
              this.r();
            }),
            U.slider('Border width px', t.borderWidth, 1, 12, 1, (v) => {
              t.borderWidth = v;
              this.r();
            })
          )
        : null,
      U.check('Shadow', t.shadow, (v) => {
        t.shadow = v;
        this.ui();
      }),
      t.shadow
        ? U.h(
            'div',
            { class: 'group' },
            U.colorAlpha('Shadow colour', t.shadowColor, (v) => {
              t.shadowColor = v;
              this.r();
            }),
            U.slider('Blur px', t.shadowBlur, 0, 40, 1, (v) => {
              t.shadowBlur = v;
              this.r();
            }),
            U.slider('Offset X px', t.shadowX, -20, 20, 1, (v) => {
              t.shadowX = v;
              this.r();
            }),
            U.slider('Offset Y px', t.shadowY, -20, 20, 1, (v) => {
              t.shadowY = v;
              this.r();
            })
          )
        : null
    );
  }

  // ---------------------------------------------------------------- minimap
  private minimapSection(): HTMLElement {
    const m = store.state.minimap;
    return U.section(
      'Minimap',
      U.check('Show minimap (M)', m.visible, (v) => {
        m.visible = v;
        this.r();
      }),
      U.select(
        'Corner',
        m.corner,
        [
          ['tl', 'Top left'],
          ['tr', 'Top right'],
          ['bl', 'Bottom left'],
          ['br', 'Bottom right'],
        ] as [typeof m.corner, string][],
        (v) => {
          m.corner = v;
          this.r();
        }
      ),
      U.slider('Width px', m.width, 160, 900, 10, (v) => {
        m.width = v;
        this.r();
      }),
      U.select(
        'Rotation',
        String(m.rotate),
        [
          ['0', '0°'],
          ['90', '90°'],
          ['180', '180°'],
          ['270', '270°'],
        ],
        (v) => {
          m.rotate = Number(v) as typeof m.rotate;
          this.r();
        }
      ),
      U.slider('Opacity', m.opacity, 0.1, 1, 0.01, (v) => {
        m.opacity = v;
        this.r();
      }),
      U.slider('Background opacity', m.bgOpacity, 0, 1, 0.01, (v) => {
        m.bgOpacity = v;
        this.r();
      }),
      U.slider('Marker size m', m.markerSize, 0.6, 4, 0.1, (v) => {
        m.markerSize = v;
        this.r();
      }),
      U.color('Map grass', m.grassColor, (v) => {
        m.grassColor = v;
        this.r();
      }),
      U.color('Map lines', m.lineColor, (v) => {
        m.lineColor = v;
        this.r();
      }),
      U.check('Shirt numbers', m.showNumbers, (v) => {
        m.showNumbers = v;
        this.r();
      }),
      U.check('Names', m.showNames, (v) => {
        m.showNames = v;
        this.r();
      }),
      U.check('Facing wedges', m.showHeading, (v) => {
        m.showHeading = v;
        this.r();
      }),
      U.check('Ball', m.showBall, (v) => {
        m.showBall = v;
        this.r();
      }),
      U.check('Arrows', m.showAnnotations, (v) => {
        m.showAnnotations = v;
        this.r();
      }),
      U.check('Throw range', m.showRange, (v) => {
        m.showRange = v;
        this.r();
      }),
      U.check('Camera cone', m.showCamera, (v) => {
        m.showCamera = v;
        this.r();
      })
    );
  }

  // ------------------------------------------------------------------ pitch
  private pitchSection(): HTMLElement {
    const p = store.state.pitch;
    return U.section(
      'Pitch & lighting',
      U.color('Grass A', p.grassA, (v) => {
        p.grassA = v;
        this.r();
      }),
      U.color('Grass B', p.grassB, (v) => {
        p.grassB = v;
        this.r();
      }),
      U.slider('Mow stripes', p.stripes, 0, 30, 1, (v) => {
        p.stripes = Math.round(v);
        this.r();
      }),
      U.color('Line colour', p.lineColor, (v) => {
        p.lineColor = v;
        this.r();
      }),
      U.slider('Line opacity', p.lineOpacity, 0.1, 1, 0.01, (v) => {
        p.lineOpacity = v;
        this.r();
      }),
      U.check('Markings', p.showLines, (v) => {
        p.showLines = v;
        this.r();
      }),
      U.check('Goals', p.showGoals, (v) => {
        p.showGoals = v;
        this.r();
      }),
      U.check('Stands', p.showStands, (v) => {
        p.showStands = v;
        this.r();
      }),
      U.color('Sky top', p.skyTop, (v) => {
        p.skyTop = v;
        this.r();
      }),
      U.color('Sky bottom', p.skyBottom, (v) => {
        p.skyBottom = v;
        this.r();
      }),
      U.slider('Sun azimuth °', p.sunAzimuth, 0, 360, 1, (v) => {
        p.sunAzimuth = v;
        this.r();
      }),
      U.slider('Sun elevation °', p.sunElevation, 5, 89, 1, (v) => {
        p.sunElevation = v;
        this.r();
      }),
      U.slider('Ambient light', p.ambient, 0.1, 2, 0.01, (v) => {
        p.ambient = v;
        this.r();
      }),
      U.check('Shadows', p.shadows, (v) => {
        p.shadows = v;
        this.r();
      })
    );
  }
}
