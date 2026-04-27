import os
import logging
import xml.etree.ElementTree as ET 
from  functools import lru_cache
from app.config.settings import PROMPTS_DIR

logger=logging.getLogger(__name__)

class PromptBuilder:
    """Assembles prompts by layering:
      base template + methodology + technology service lines + few-shot examples

    Reads ONLY from XML files. Never touches the database."""

    def __init__(self,prompts_dir:str = PROMPTS_DIR) -> None:
        self.prompts_dir=prompts_dir

    def build(
            self,
            artifact_type:str,
            methodology:str,
            service_line_codes:list[str],
            template_vars:dict
    ):
        """Build a complete (system_prompt, user_prompt) pair.

        template_vars contains dynamic content:
          sow_sections, module_name, module_description,
          relevant_sections, module_prefix, etc.

        Returns (system_prompt, user_prompt)."""

        # 1. Load base template
        base=self._load_base_template(artifact_type)

        # 2. Load methodology instructions
        meth_instructions=self._load_methodology_instructions(methodology,artifact_type)

        # 3. Merge ALL technology service line instructions (additive)
        sl_instructions=self._merge_service_line_instructions(service_line_codes,artifact_type)

        # 4. Load few-shot examples
        examples=self._load_examples(methodology,artifact_type)

        # 5. Substitute placeholders
        template_vars["methodology_instructions"]=meth_instructions
        template_vars["service_line_instructions"]=sl_instructions
        template_vars["few_shot_examples"]=examples

        system_prompt=base["system"]
        user_prompt=base["user"]

        for key,value in template_vars.items():
            system_prompt=system_prompt.replace(f"{{{key}}}",str(value))
            user_prompt=user_prompt.replace(f"{{{key}}}",str(value))

        return system_prompt.strip(),user_prompt.strip()


    def _merge_service_line_instructions(self,service_line_codes:list[str],artifact_type:str):
        """Merge instructions from all selected service lines."""
        if not service_line_codes:
            return ""
        
        parts=[]

        for sl_code in service_line_codes:
            instructions=self._load_service_line_instructions(sl_code,artifact_type)

            parts.append(
                f"###{sl_code.replace('_',' ').upper()} Considerations\n"
                f"{instructions}")
            
        return "\n\n".join(parts)

    @lru_cache(maxsize=32)
    def _load_base_template(self,artifact_type:str):
        path=os.path.join(self.prompts_dir,"base",f"{artifact_type}.xml")
        tree=ET.parse(path)
        root=tree.getroot()
        return {
            "system":root.findtext("system",default=""),
            "user":root.findtext("user",default="")
        }
    
    @lru_cache(maxsize=16)
    def _load_methodology_instructions(self,methodology:str,artifact_type:str):
        path=os.path.join(self.prompts_dir,"methodology",f"{methodology}.xml")

        if not os.path.exists(path):
            logger.warning(f"No methodology config for: {methodology}")
            return ""
        
        tree=ET.parse(path)
        root=tree.getroot()

        global_inst=root.findtext("global_instructions",default="")
        
        overrides_el=root.find("artifact_overrides")

        specific=""

        if overrides_el is not None:
            specific=overrides_el.findtext(artifact_type,default="")

        combined = f"{global_inst}\n\n{specific}".strip()
        return combined if combined else ""
    
    @lru_cache(maxsize=32)
    def _load_service_line_instructions(self,service_line_code:str,artifact_type:str):
        path=os.path.join(self.prompts_dir,"service_line",f"{service_line_code}.xml")

        if not os.path.exists(path):
            logger.warning(f"No service line config for: {service_line_code}")
            return ""
        
        tree=ET.parse(path)
        root=tree.getroot()

        domain_ctx=root.findtext("tech_context",default="")
        overrides_el=root.find("artifact_overrides")
        specific=""

        if overrides_el is not None:
            specific=overrides_el.findtext(artifact_type,default="")

        combined=f"{domain_ctx}\n\n{specific}".strip()

        return combined if combined else ""
    
    @lru_cache(maxsize=32)
    def _load_examples(self,methodology:str,artifact_type:str):
        path=os.path.join(self.prompts_dir,"examples",methodology,f"{artifact_type}_example.xml")

        if not os.path.exists(path):
             return ""
        
        with open(path, "r") as f:
            content = f.read()

        return f"Here is an example of good output:\n\n{content}"



